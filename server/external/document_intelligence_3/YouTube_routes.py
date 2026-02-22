from fastapi import APIRouter, Depends, HTTPException, Body, Path
from config import get_settings, Settings
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from Managers.Document_Intelligence_3.YouTube_Intelligence import YouTubeIntelligence
from Managers.Embed_2.Embed import EmbedManager

router = APIRouter()

class YouTubeProcessRequest(BaseModel):
    video_url: str = Field(..., description="YouTube video URL")
    bot_id: str = Field(..., description="Bot ID for multi-tenancy")
    user_id: Optional[str] = Field(None, description="User ID")
    extract_captions: bool = Field(True, description="Extract captions with timestamps")
    extract_transcripts: bool = Field(True, description="Extract full transcript")
    index_name: str = Field("default-index", description="Search index name")

class YouTubeBatchProcessRequest(BaseModel):
    video_urls: List[str] = Field(..., description="List of YouTube video URLs")
    bot_id: str = Field(..., description="Bot ID for multi-tenancy")
    user_id: Optional[str] = Field(None, description="User ID")
    extract_captions: bool = Field(True, description="Extract captions with timestamps")
    extract_transcripts: bool = Field(True, description="Extract full transcript")
    index_name: str = Field("default-index", description="Search index name")

async def get_youtube_processor():
    """Dependency to get YouTube processor instance"""
    return YouTubeIntelligence()

async def get_embed_manager(settings: Settings = Depends(get_settings)):
    """Dependency to get the Embed Manager instance"""
    if not settings.search_api_key or not settings.search_service_name:
        raise HTTPException(
            status_code=500,
            detail="Azure Search API key or service name is not set"
        )
    return EmbedManager(settings)

@router.post("/process-youtube-video")
async def process_youtube_video(
    request: YouTubeProcessRequest = Body(...),
    youtube_processor: YouTubeIntelligence = Depends(get_youtube_processor),
    embed_manager: EmbedManager = Depends(get_embed_manager)
):
    """
    Process a single YouTube video, extract captions/transcripts, and index them.
    Returns detailed information about the processing results.
    """
    try:
        # Process the YouTube video - Use Supadata transcript extraction
        if request.extract_transcripts:
            # Use Supadata for transcript extraction
            result = await youtube_processor.youtubeCalled_transcript_only(
                video_url=request.video_url,
                bot_id=request.bot_id,
                lang="en",
                user_id=request.user_id
            )
        else:
            # Fallback to original method if only captions needed
            result = await youtube_processor.process_youtube_video(
                video_url=request.video_url,
                bot_id=request.bot_id,
                extract_captions=request.extract_captions,
                extract_transcripts=request.extract_transcripts,
                user_id=request.user_id
            )
        
        if not result.get('success', True) or 'error' in result:
            error_msg = result.get('error', 'Processing failed')
            raise HTTPException(status_code=400, detail=error_msg)
        
        # Index the documents
        if result['documents']:
            # Convert documents to the format expected by embed manager
            documents_for_indexing = []
            for doc in result['documents']:
                documents_for_indexing.append({
                    'id': doc['id'],
                    'content': doc['content'],
                    'metadata': doc['metadata']
                })
            
            # Upload to search index
            index_result = await embed_manager.upload_documents(
                index_name=request.index_name,
                documents=documents_for_indexing
            )
            
            if index_result.get('status') == 'error':
                raise HTTPException(status_code=500, detail=f"Indexing failed: {index_result.get('message')}")
            
            result['indexing_result'] = index_result
        
        return {
            'status': 'success',
            'video_url': request.video_url,
            'video_id': result.get('video_id'),
            'video_title': result.get('metadata', {}).get('title', ''),
            'document_count': result.get('document_count', 0),
            'captions_extracted': request.extract_captions,
            'transcripts_extracted': request.extract_transcripts,
            'indexed_to': request.index_name,
            'processing_details': result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

@router.post("/process-youtube-batch")
async def process_youtube_batch(
    request: YouTubeBatchProcessRequest = Body(...),
    youtube_processor: YouTubeIntelligence = Depends(get_youtube_processor),
    embed_manager: EmbedManager = Depends(get_embed_manager)
):
    """
    Process multiple YouTube videos in batch.
    Returns summary of processing results for all videos.
    """
    try:
        results = []
        all_documents = []
        successful_videos = 0
        failed_videos = 0
        
        for video_url in request.video_urls:
            try:
                # Process each video - Use Supadata transcript extraction
                if request.extract_transcripts:
                    # Use Supadata for transcript extraction
                    result = await youtube_processor.youtubeCalled_transcript_only(
                        video_url=video_url,
                        bot_id=request.bot_id,
                        lang="en",
                        user_id=request.user_id
                    )
                else:
                    # Fallback to original method if only captions needed
                    result = await youtube_processor.process_youtube_video(
                        video_url=video_url,
                        bot_id=request.bot_id,
                        extract_captions=request.extract_captions,
                        extract_transcripts=request.extract_transcripts,
                        user_id=request.user_id
                    )
                
                if not result.get('success', True) or 'error' in result:
                    error_msg = result.get('error', 'Processing failed')
                    results.append({
                        'video_url': video_url,
                        'status': 'error',
                        'error': error_msg
                    })
                    failed_videos += 1
                else:
                    results.append({
                        'video_url': video_url,
                        'status': 'success',
                        'video_id': result.get('video_id'),
                        'video_title': result.get('metadata', {}).get('title', ''),
                        'document_count': result.get('document_count', 0)
                    })
                    all_documents.extend(result['documents'])
                    successful_videos += 1
                    
            except Exception as e:
                results.append({
                    'video_url': video_url,
                    'status': 'error',
                    'error': str(e)
                })
                failed_videos += 1
        
        # Index all documents together if any were successfully processed
        indexing_result = None
        if all_documents:
            try:
                # Convert documents to the format expected by embed manager
                documents_for_indexing = []
                for doc in all_documents:
                    documents_for_indexing.append({
                        'id': doc['id'],
                        'content': doc['content'],
                        'metadata': doc['metadata']
                    })
                
                # Upload to search index
                indexing_result = await embed_manager.upload_documents(
                    index_name=request.index_name,
                    documents=documents_for_indexing
                )
                
            except Exception as e:
                indexing_result = {
                    'status': 'error',
                    'message': f"Indexing failed: {str(e)}"
                }
        
        return {
            'status': 'completed',
            'total_videos': len(request.video_urls),
            'successful_videos': successful_videos,
            'failed_videos': failed_videos,
            'total_documents': len(all_documents),
            'indexed_to': request.index_name,
            'indexing_result': indexing_result,
            'video_results': results
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch processing failed: {str(e)}")

@router.get("/youtube-video-info/{video_id}")
async def get_youtube_video_info(
    video_id: str,
    youtube_processor: YouTubeIntelligence = Depends(get_youtube_processor)
):
    """Get basic information about a YouTube video without processing it."""
    try:
        video_url = f"https://www.youtube.com/watch?v={video_id}"
        metadata = await youtube_processor.get_video_metadata(video_url)
        
        if 'error' in metadata:
            raise HTTPException(status_code=404, detail=f"Video not found: {metadata['error']}")
        
        return {
            'status': 'success',
            'video_id': video_id,
            'metadata': metadata
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get video info: {str(e)}")

@router.post("/extract-youtube-captions")
async def extract_youtube_captions(
    video_url: str = Body(..., embed=True),
    youtube_processor: YouTubeIntelligence = Depends(get_youtube_processor)
):
    """Extract captions with timestamps from a YouTube video."""
    try:
        video_id = youtube_processor.extract_video_id(video_url)
        if not video_id:
            raise HTTPException(status_code=400, detail="Invalid YouTube URL")
        
        captions = await youtube_processor.get_captions_with_timestamps(video_id)
        
        return {
            'status': 'success',
            'video_id': video_id,
            'video_url': video_url,
            'caption_count': len(captions),
            'captions': captions
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Caption extraction failed: {str(e)}")

@router.post("/extract-youtube-transcript")
async def extract_youtube_transcript(
    video_url: str = Body(..., embed=True),
    youtube_processor: YouTubeIntelligence = Depends(get_youtube_processor)
):
    """Extract full transcript from a YouTube video."""
    try:
        video_id = youtube_processor.extract_video_id(video_url)
        if not video_id:
            raise HTTPException(status_code=400, detail="Invalid YouTube URL")
        
        transcript = await youtube_processor.get_full_transcript(video_id)
        
        return {
            'status': 'success',
            'video_id': video_id,
            'video_url': video_url,
            'transcript': transcript
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcript extraction failed: {str(e)}")

@router.post("/extract-youtube-supadata")
async def extract_youtube_supadata(
    request: YouTubeProcessRequest = Body(...),
    youtube_processor: YouTubeIntelligence = Depends(get_youtube_processor),
    embed_manager: EmbedManager = Depends(get_embed_manager)
):
    """
    Extract YouTube transcript using Supadata and index it.
    This endpoint specifically uses Supadata for transcript extraction.
    """
    try:
        # Use Supadata for transcript extraction only
        result = await youtube_processor.youtubeCalled_transcript_only(
            video_url=request.video_url,
            bot_id=request.bot_id,
            lang="en",
            user_id=request.user_id
        )
        
        if not result.get('success'):
            raise HTTPException(status_code=400, detail=result.get('error', 'Supadata extraction failed'))
        
        # Index the documents
        if result.get('documents'):
            # Convert documents to the format expected by embed manager
            documents_for_indexing = []
            for doc in result['documents']:
                documents_for_indexing.append({
                    'id': doc['id'],
                    'content': doc['content'],
                    'metadata': doc['metadata']
                })
            
            # Upload to search index
            index_result = await embed_manager.upload_documents(
                index_name=request.index_name,
                documents=documents_for_indexing
            )
            
            if index_result.get('status') == 'error':
                raise HTTPException(status_code=500, detail=f"Indexing failed: {index_result.get('message')}")
            
            result['indexing_result'] = index_result
        
        return {
            'status': 'success',
            'video_url': request.video_url,
            'video_id': result.get('video_id'),
            'document_count': result.get('document_count', 0),
            'extraction_source': result.get('extraction_source', 'supadata'),
            'indexed_to': request.index_name,
            'processing_details': result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Supadata processing failed: {str(e)}")

@router.get("/youtube-languages/{video_id}")
async def get_youtube_available_languages(
    video_id: str = Path(..., description="YouTube video ID"),
    youtube_processor: YouTubeIntelligence = Depends(get_youtube_processor)
):
    """Get available languages for captions and transcripts for a YouTube video."""
    try:
        languages = await youtube_processor.get_available_languages(video_id)
        
        return {
            'status': 'success',
            'video_id': video_id,
            'languages': languages
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get available languages: {str(e)}")