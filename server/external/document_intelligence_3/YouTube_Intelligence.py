import os
import re
import json
import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import yt_dlp
import aiohttp
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.formatters import TextFormatter
from supadata import Supadata, SupadataError
from config import get_settings
from logging_config import get_logger

# Module logger
logger = get_logger(__name__)

settings = get_settings()
supadata_api_key = settings.SUPADATA_API_KEY

class YouTubeIntelligence:
    def __init__(self, ):
        logger.debug("Initializing YouTubeIntelligence manager")

        # Initialize Supadata client
        self.supadata = Supadata(api_key=supadata_api_key)
        logger.info("YouTubeIntelligence manager initialized successfully")
        
        # Supported languages in priority order (most common first)
        self.supported_languages = [
            'en', 'en-US', 'en-GB', 'en-AU', 'en-CA',  # English variants
            'es', 'es-ES', 'es-MX', 'es-AR',           # Spanish variants
            'fr', 'fr-FR', 'fr-CA',                    # French variants
            'de', 'de-DE',                             # German
            'it', 'it-IT',                             # Italian
            'pt', 'pt-BR', 'pt-PT',                    # Portuguese variants
            'ru', 'ru-RU',                             # Russian
            'ja', 'ja-JP',                             # Japanese
            'ko', 'ko-KR',                             # Korean
            'zh', 'zh-CN', 'zh-TW', 'zh-HK',          # Chinese variants
            'hi', 'hi-IN',                             # Hindi
            'ar', 'ar-SA',                             # Arabic
            'nl', 'nl-NL',                             # Dutch
            'sv', 'sv-SE',                             # Swedish
            'no', 'no-NO',                             # Norwegian
            'da', 'da-DK',                             # Danish
            'fi', 'fi-FI',                             # Finnish
            'pl', 'pl-PL',                             # Polish
            'tr', 'tr-TR',                             # Turkish
            'th', 'th-TH',                             # Thai
            'vi', 'vi-VN',                             # Vietnamese
            'id', 'id-ID',                             # Indonesian
            'ms', 'ms-MY',                             # Malay
            'ta', 'ta-IN',                             # Tamil
            'te', 'te-IN',                             # Telugu
            'ml', 'ml-IN',                             # Malayalam
            'kn', 'kn-IN',                             # Kannada
            'bn', 'bn-IN',                             # Bengali
            'gu', 'gu-IN',                             # Gujarati
            'mr', 'mr-IN',                             # Marathi
            'pa', 'pa-IN',                             # Punjabi
            'ur', 'ur-PK'                              # Urdu
        ]
        
        self.ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'writesubtitles': True,
            'writeautomaticsub': True,
            'subtitleslangs': self.supported_languages,
            'skip_download': True,
        }
    
    def extract_video_id(self, url: str) -> Optional[str]:
        """Extract video ID from various YouTube URL formats"""
        patterns = [
            r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)',
            r'youtube\.com\/watch\?.*v=([^&\n?#]+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None
    
    async def get_available_languages(self, video_id: str) -> Dict[str, List[str]]:
        """Get list of available languages for captions and transcripts"""
        try:
            print(f"DEBUG: Getting available languages for video_id: {video_id}")
            transcript_list = await asyncio.to_thread(YouTubeTranscriptApi.list_transcripts, video_id)
            print(f"DEBUG: Retrieved transcript list: {transcript_list}")
            
            manual_languages = []
            auto_languages = []
            
            # Get manually created transcripts
            for transcript in transcript_list:
                if transcript.is_generated:
                    auto_languages.append({
                        'language_code': transcript.language_code,
                        'language': transcript.language
                    })
                else:
                    manual_languages.append({
                        'language_code': transcript.language_code,
                        'language': transcript.language
                    })
            
            result = {
                'manual': manual_languages,
                'auto_generated': auto_languages,
                'total_count': len(manual_languages) + len(auto_languages)
            }
            print(f"DEBUG: Available languages result: {result}")
            return result
            
        except Exception as e:
            logger.error(f"Error getting available languages for video {video_id}: {str(e)}")
            print(f"DEBUG: Exception getting languages: {str(e)}")
            return {'manual': [], 'auto_generated': [], 'total_count': 0}
    
    async def _download_and_parse_subtitle(self, subtitle_url: str) -> str:
        """Download and parse subtitle content from URL asynchronously."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(subtitle_url, timeout=30) as response:
                    content = await response.text()

            lines = content.splitlines()
            text_lines = []
            is_vtt = content.startswith("WEBVTT")
            
            for line in lines:
                line = line.strip()
                if not line or line.isdigit():
                    continue
                if is_vtt and (line.startswith("WEBVTT") or "-->" in line):
                    continue
                if not is_vtt and "-->" in line:
                    continue
                
                # Clean line
                clean_line = re.sub(r'<[^>]+>', '', line)  # Remove HTML-like tags
                clean_line = re.sub(r'\[.*?\]', '', clean_line)  # Remove sound descriptions in brackets
                clean_line = re.sub(r'\(.*?\)', '', clean_line)  # Remove content in parentheses
                if clean_line:
                    text_lines.append(clean_line)
            
            return ' '.join(text_lines)

        except Exception as e:
            print(f"DEBUG: Error downloading subtitle content: {str(e)}")
            return ""

    async def extract_from_yt_dlp_subtitles(self, video_url: str) -> Dict[str, Any]:
        """Try to extract subtitles directly from yt-dlp asynchronously."""
        try:
            print(f"DEBUG: Attempting yt-dlp subtitle extraction for: {video_url}")
            
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'writesubtitles': True,
                'writeautomaticsub': True,
                'subtitleslangs': self.supported_languages,
                'skip_download': True,
                'subtitlesformat': 'vtt/srt/best',
            }

            def extract_info():
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    return ydl.extract_info(video_url, download=False)

            info = await asyncio.to_thread(extract_info)
            
            subtitles = info.get('subtitles', {})
            automatic_captions = info.get('automatic_captions', {})
            
            print(f"DEBUG: Available subtitles via yt-dlp: {list(subtitles.keys())}")
            print(f"DEBUG: Available automatic captions via yt-dlp: {list(automatic_captions.keys())}")
            
            for lang in self.supported_languages:
                if lang in subtitles:
                    print(f"DEBUG: Found manual subtitles in {lang}")
                    subtitle_url = subtitles[lang][0]['url']
                    subtitle_text = await self._download_and_parse_subtitle(subtitle_url)
                    if subtitle_text:
                        print(f"DEBUG: Successfully extracted manual subtitles in {lang}, length: {len(subtitle_text)}")
                        return {'text': subtitle_text, 'type': 'manual', 'language': lang, 'source': 'yt-dlp'}
                
                if lang in automatic_captions:
                    print(f"DEBUG: Found auto captions in {lang}")
                    subtitle_url = automatic_captions[lang][0]['url']
                    subtitle_text = await self._download_and_parse_subtitle(subtitle_url)
                    if subtitle_text:
                        print(f"DEBUG: Successfully extracted auto captions in {lang}, length: {len(subtitle_text)}")
                        return {'text': subtitle_text, 'type': 'auto', 'language': lang, 'source': 'yt-dlp'}

            print("DEBUG: No subtitles found via yt-dlp in any supported language.")
            return {'text': '', 'type': 'none', 'source': 'yt-dlp'}
                
        except Exception as e:
            print(f"DEBUG: Error with yt-dlp subtitle extraction: {str(e)}")
            logger.error(f"Error with yt-dlp subtitle extraction for {video_url}: {e}")
            return {'text': '', 'type': 'error', 'source': 'yt-dlp', 'error': str(e)}

    async def get_video_metadata(self, video_url: str) -> Dict[str, Any]:
        """Extract video metadata using yt-dlp"""
        try:
            print(f"DEBUG: Extracting metadata for URL: {video_url}")
            
            def extract_info():
                with yt_dlp.YoutubeDL(self.ydl_opts) as ydl:
                    return ydl.extract_info(video_url, download=False)

            info = await asyncio.to_thread(extract_info)
            print(f"DEBUG: Raw metadata info keys: {list(info.keys()) if info else 'None'}")
            
            metadata = {
                'video_id': info.get('id'),
                'title': info.get('title', ''),
                'description': info.get('description', ''),
                'uploader': info.get('uploader', ''),
                'upload_date': info.get('upload_date', ''),
                'duration': info.get('duration', 0),
                'view_count': info.get('view_count', 0),
                'like_count': info.get('like_count', 0),
                'tags': info.get('tags', []),
                'categories': info.get('categories', []),
                'thumbnail': info.get('thumbnail', ''),
                'webpage_url': info.get('webpage_url', video_url),
            }
            print(f"DEBUG: Extracted metadata: {metadata}")
            return metadata
        except Exception as e:
            logger.error(f"Error extracting metadata for {video_url}: {str(e)}")
            return {'error': str(e)}
    
    async def get_captions_with_timestamps(self, video_id: str) -> List[Dict[str, Any]]:
        """Get captions with precise timestamps using YouTube Transcript API"""
        try:
            print(f"DEBUG: Getting captions with timestamps for video_id: {video_id}")
            transcript_list = await asyncio.to_thread(YouTubeTranscriptApi.list_transcripts, video_id)
            
            caption_data = []
            transcript = None
            caption_type = None
            language_used = None
            
            # Try manual captions first (more accurate)
            try:
                manual_transcript = transcript_list.find_manually_created_transcript(self.supported_languages)
                transcript_content = await asyncio.to_thread(manual_transcript.fetch)
                transcript = transcript_content
                caption_type = 'manual'
                language_used = manual_transcript.language_code
                print(f"DEBUG: Found manual captions - Language: {language_used}, Count: {len(transcript) if transcript else 0}")
                logger.info(f"Found manual captions for video {video_id} in language: {language_used}")
            except Exception:
                # Try auto-generated captions
                try:
                    auto_transcript = transcript_list.find_generated_transcript(self.supported_languages)
                    transcript_content = await asyncio.to_thread(auto_transcript.fetch)
                    transcript = transcript_content
                    caption_type = 'auto'
                    language_used = auto_transcript.language_code
                    print(f"DEBUG: Found auto-generated captions - Language: {language_used}, Count: {len(transcript) if transcript else 0}")
                    logger.info(f"Found auto-generated captions for video {video_id} in language: {language_used}")
                except Exception as e:
                    logger.warning(f"No captions found for video {video_id} in any supported language: {e}")
                    return []
            
            if not transcript:
                return []
            
            for entry in transcript:
                caption_data.append({
                    'text': entry['text'],
                    'start': entry['start'],
                    'duration': entry['duration'],
                    'end': entry['start'] + entry['duration'],
                    'type': caption_type,
                    'language': language_used
                })
            
            print(f"DEBUG: Caption data sample (first 3): {caption_data[:3] if caption_data else 'None'}")
            print(f"DEBUG: Total captions extracted: {len(caption_data)}")
            return caption_data
            
        except Exception as e:
            logger.error(f"Error getting captions for video {video_id}: {str(e)}")
            return []
    
    async def get_full_transcript(self, video_id: str) -> Dict[str, Any]:
        """Get full transcript text without timestamps"""
        try:
            print(f"DEBUG: Getting full transcript for video_id: {video_id}")
            transcript_list = await asyncio.to_thread(YouTubeTranscriptApi.list_transcripts, video_id)
            
            transcript_content = None
            transcript_type = None
            language_used = None
            
            # Try manual first (more accurate)
            try:
                manual_transcript = transcript_list.find_manually_created_transcript(self.supported_languages)
                transcript_content = await asyncio.to_thread(manual_transcript.fetch)
                transcript_type = 'manual'
                language_used = manual_transcript.language_code
                print(f"DEBUG: Found manual transcript - Language: {language_used}, Entries: {len(transcript_content) if transcript_content else 0}")
                logger.info(f"Found manual transcript for video {video_id} in language: {language_used}")
            except Exception:
                # Then auto-generated
                try:
                    auto_transcript = transcript_list.find_generated_transcript(self.supported_languages)
                    transcript_content = await asyncio.to_thread(auto_transcript.fetch)
                    transcript_type = 'auto'
                    language_used = auto_transcript.language_code
                    print(f"DEBUG: Found auto-generated transcript - Language: {language_used}, Entries: {len(transcript_content) if transcript_content else 0}")
                    logger.info(f"Found auto-generated transcript for video {video_id} in language: {language_used}")
                except Exception as e:
                    logger.warning(f"No transcript found for video {video_id} in any supported language: {e}")
                    return {'text': '', 'type': 'none', 'error': 'No transcript available'}
            
            if not transcript_content:
                return {'text': '', 'type': 'none', 'error': 'No transcript available'}
            
            # Format as plain text
            formatter = TextFormatter()
            full_text = formatter.format_transcript(transcript_content)
            
            result = {
                'text': full_text,
                'type': transcript_type,
                'language': language_used,
                'word_count': len(full_text.split()),
                'duration': transcript_content[-1]['start'] + transcript_content[-1]['duration'] if transcript_content else 0
            }
            print(f"DEBUG: Full transcript result - Word count: {result['word_count']}, Duration: {result['duration']}, Type: {result['type']}")
            print(f"DEBUG: Transcript text preview (first 200 chars): {full_text[:200] if full_text else 'None'}...")
            return result
            
        except Exception as e:
            logger.error(f"Error getting transcript for video {video_id}: {str(e)}")
            return {'text': '', 'type': 'error', 'error': str(e)}
    
    def format_timestamp(self, seconds: float) -> str:
        """Convert seconds to HH:MM:SS format"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        
        if hours > 0:
            return f"{hours:02d}:{minutes:02d}:{secs:02d}"
        else:
            return f"{minutes:02d}:{secs:02d}"
    
    def create_timestamped_url(self, base_url: str, timestamp: float) -> str:
        """Create YouTube URL with timestamp"""
        timestamp_seconds = int(timestamp)
        return f"{base_url}&t={timestamp_seconds}s"
    
    async def chunk_captions_by_time(self, captions: List[Dict[str, Any]], 
                                   chunk_duration: int = 60) -> List[Dict[str, Any]]:
        """Chunk captions into time-based segments"""
        if not captions:
            return []
        
        chunks = []
        current_chunk = {
            'text': '',
            'start_time': captions[0]['start'],
            'end_time': captions[0]['start'],
            'captions': []
        }
        
        for caption in captions:
            # If this caption would extend the chunk beyond the duration limit
            if caption['end'] - current_chunk['start_time'] > chunk_duration:
                # Finish current chunk
                if current_chunk['text'].strip():
                    chunks.append(current_chunk)
                
                # Start new chunk
                current_chunk = {
                    'text': caption['text'],
                    'start_time': caption['start'],
                    'end_time': caption['end'],
                    'captions': [caption]
                }
            else:
                # Add to current chunk
                current_chunk['text'] += ' ' + caption['text']
                current_chunk['end_time'] = caption['end']
                current_chunk['captions'].append(caption)
        
        # Add final chunk
        if current_chunk['text'].strip():
            chunks.append(current_chunk)
        
        return chunks
    
    async def process_youtube_video(self, video_url: str, bot_id: str, 
                                  extract_captions: bool = True, 
                                  extract_transcripts: bool = True,
                                  user_id: str = None) -> Dict[str, Any]:
        """Process a YouTube video and return structured data for indexing"""
        try:
            print(f"DEBUG: Starting YouTube video processing for URL: {video_url}")
            video_id = self.extract_video_id(video_url)
            if not video_id:
                return {'error': 'Invalid YouTube URL'}
            print(f"DEBUG: Extracted video_id: {video_id}")
            
            # Get video metadata
            metadata = await self.get_video_metadata(video_url)
            if 'error' in metadata:
                return {'error': f"Failed to get metadata: {metadata['error']}"}
            
            result = {
                'video_id': video_id,
                'video_url': video_url,
                'metadata': metadata,
                'bot_id': bot_id,
                'processing_time': datetime.now().isoformat(),
                'documents': []
            }
            
            documents = []
            
            # Process captions with timestamps
            if extract_captions:
                print(f"DEBUG: Extracting captions...")
                captions = await self.get_captions_with_timestamps(video_id)
                if captions:
                    print(f"DEBUG: Processing {len(captions)} captions into chunks")
                    # Chunk captions into 60-second segments
                    caption_chunks = await self.chunk_captions_by_time(captions, 60)
                    print(f"DEBUG: Created {len(caption_chunks)} caption chunks")
                    
                    for i, chunk in enumerate(caption_chunks):
                        # Map YouTube metadata to existing index fields
                        timestamped_url = self.create_timestamped_url(video_url, chunk['start_time'])
                        
                        doc = {
                            'id': f"{video_id}_caption_{i}",
                            'content': chunk['text'],
                            'metadata': {
                                'source': video_url,
                                'chunk': i,  # Use existing chunk field
                                'page_number': None,  # Not applicable for YouTube
                                'extraction_time': datetime.now().isoformat(),
                                'context': f"YouTube Video: {metadata.get('title', '')} by {metadata.get('uploader', '')}",
                                'page_summary': f"Caption segment {i+1} ({self.format_timestamp(chunk['start_time'])} - {self.format_timestamp(chunk['end_time'])})",
                                'keywords': f"video_id:{video_id},content_type:youtube_caption,language:{captions[0].get('language', 'unknown') if captions else 'unknown'},start_time:{chunk['start_time']},end_time:{chunk['end_time']},timestamped_url:{timestamped_url}",
                                'bot_id': bot_id,
                                'user_id': user_id
                            }
                        }
                        documents.append(doc)
            
            # Process full transcript
            if extract_transcripts:
                print(f"DEBUG: Extracting full transcript...")
                transcript_data = await self.get_full_transcript(video_id)
                
                # If no transcript found via YouTube API, try yt-dlp
                if not transcript_data.get('text'):
                    print(f"DEBUG: No transcript via YouTube API, trying yt-dlp...")
                    yt_dlp_data = await self.extract_from_yt_dlp_subtitles(video_url)
                    if yt_dlp_data.get('text'):
                        transcript_data = {
                            'text': yt_dlp_data['text'],
                            'type': yt_dlp_data['type'],
                            'language': yt_dlp_data.get('language', 'unknown'),
                            'word_count': len(yt_dlp_data['text'].split()),
                            'duration': metadata.get('duration', 0),
                            'source': 'yt-dlp'
                        }
                        print(f"DEBUG: Successfully got transcript via yt-dlp: {transcript_data['word_count']} words from language {transcript_data['language']}")
                
                if transcript_data.get('text'):
                    print(f"DEBUG: Processing transcript with {transcript_data['word_count']} words into chunks")
                    # Chunk transcript into smaller pieces for better retrieval
                    transcript_text = transcript_data['text']
                    words = transcript_text.split()
                    chunk_size = 300  # words per chunk
                    print(f"DEBUG: Creating transcript chunks with {chunk_size} words each")
                    
                    for i in range(0, len(words), chunk_size):
                        chunk_words = words[i:i + chunk_size]
                        chunk_text = ' '.join(chunk_words)
                        
                        chunk_index = i // chunk_size
                        doc = {
                            'id': f"{video_id}_transcript_{chunk_index}",
                            'content': chunk_text,
                            'metadata': {
                                'source': video_url,
                                'chunk': chunk_index,  # Use existing chunk field
                                'page_number': None,  # Not applicable for YouTube
                                'extraction_time': datetime.now().isoformat(),
                                'context': f"YouTube Video: {metadata.get('title', '')} by {metadata.get('uploader', '')}",
                                'page_summary': f"Transcript segment {chunk_index+1} (words {i+1}-{min(i + chunk_size, len(words))})",
                                'keywords': f"video_id:{video_id},content_type:youtube_transcript,language:{transcript_data.get('language', 'unknown')},transcript_type:{transcript_data.get('type', 'unknown')},word_start:{i},word_end:{min(i + chunk_size, len(words))},duration:{transcript_data.get('duration', 0)}",
                                'bot_id': bot_id,
                                'user_id': user_id
                            }
                        }
                        documents.append(doc)
            
            # Add video metadata document
            tags_str = ', '.join(metadata.get('tags', [])[:10])
            metadata_doc = {
                'id': f"{video_id}_metadata",
                'content': f"Video: {metadata.get('title', '')}. Description: {metadata.get('description', '')[:500]}. Tags: {tags_str}",
                'metadata': {
                    'source': video_url,
                    'chunk': None,  # Not applicable for metadata
                    'page_number': None,  # Not applicable for YouTube  
                    'extraction_time': datetime.now().isoformat(),
                    'context': f"YouTube Video Metadata: {metadata.get('title', '')} by {metadata.get('uploader', '')}",
                    'page_summary': f"Video uploaded on {metadata.get('upload_date', '')} with {metadata.get('view_count', 0)} views",
                    'keywords': f"video_id:{video_id},content_type:youtube_metadata,duration:{metadata.get('duration', 0)},view_count:{metadata.get('view_count', 0)},upload_date:{metadata.get('upload_date', '')},tags:{tags_str}",
                    'bot_id': bot_id,
                    'user_id': None  # Will be set by caller if needed
                }
            }
            documents.append(metadata_doc)
            
            result['documents'] = documents
            result['document_count'] = len(documents)
            print(f"DEBUG: Final processing result - Total documents: {len(documents)}")
            print(f"DEBUG: Document types: {[doc['id'].split('_')[1] for doc in documents[:5]] if documents else 'None'}")
            return result
            
        except Exception as e:
            logger.error(f"Error processing YouTube video {video_url}: {str(e)}")
            return {'error': f"Processing failed: {str(e)}"}
    
    async def youtubeCalled(self, video_url: str, lang: str = "en", text: bool = True, mode: str = "auto") -> Dict[str, Any]:
        """Extract YouTube transcript using Supadata API
        
        Args:
            video_url: YouTube video URL
            lang: Preferred language for transcript (default: 'en')
            text: Return plain text instead of timestamped chunks (default: True)
            mode: Extraction mode - 'native', 'auto', or 'generate' (default: 'auto')
            
        Returns:
            Dict containing transcript data or error information
        """
        try:
            print(f"DEBUG: Using Supadata to extract transcript from: {video_url}")
            print(f"DEBUG: Parameters - lang: {lang}, text: {text}, mode: {mode}")
            
            # Extract transcript using Supadata
            transcript = self.supadata.transcript(
                url=video_url,
                lang=lang,
                text=text,
                mode=mode
            )
            
            if transcript:
                # Extract video ID for consistency with other methods
                video_id = self.extract_video_id(video_url)
                
                # Handle Transcript object conversion
                if text:
                    # For text format, convert Transcript object to string
                    if hasattr(transcript, 'text'):
                        transcript_text = transcript.text
                    elif hasattr(transcript, '__str__'):
                        transcript_text = str(transcript)
                    else:
                        transcript_text = transcript
                    
                    # Ensure we have a string
                    if not isinstance(transcript_text, str):
                        transcript_text = str(transcript_text)
                    
                    transcript_to_store = transcript_text
                else:
                    # For non-text format, keep original structure
                    transcript_to_store = transcript
                
                result = {
                    'success': True,
                    'video_id': video_id,
                    'video_url': video_url,
                    'transcript': transcript_to_store,
                    'language': lang,
                    'mode': mode,
                    'text_format': text,
                    'extraction_time': datetime.now().isoformat(),
                    'source': 'supadata'
                }
                
                # Add word count if text format
                if text and isinstance(transcript_to_store, str):
                    result['word_count'] = len(transcript_to_store.split())
                    result['char_count'] = len(transcript_to_store)
                    print(f"DEBUG: Successfully extracted transcript via Supadata - {result['word_count']} words, {result['char_count']} characters")
                elif not text and isinstance(transcript_to_store, list):
                    result['segment_count'] = len(transcript_to_store)
                    print(f"DEBUG: Successfully extracted transcript via Supadata - {result['segment_count']} segments")
                else:
                    print(f"DEBUG: Successfully extracted transcript via Supadata - type: {type(transcript_to_store)}")
                
                return result
            else:
                return {
                    'success': False,
                    'error': 'No transcript returned from Supadata',
                    'video_url': video_url,
                    'source': 'supadata'
                }
                
        except SupadataError as e:
            logger.error(f"Supadata error extracting transcript from {video_url}: {str(e)}")
            return {
                'success': False,
                'error': f'Supadata error: {str(e)}',
                'video_url': video_url,
                'source': 'supadata'
            }
        except Exception as e:
            logger.error(f"Unexpected error extracting transcript from {video_url}: {str(e)}")
            return {
                'success': False,
                'error': f'Unexpected error: {str(e)}',
                'video_url': video_url,
                'source': 'supadata'
            }
    
    async def youtubeCalled_transcript_only(self, video_url: str, bot_id: str, lang: str = "en", user_id: str = None) -> Dict[str, Any]:
        """Extract YouTube transcript ONLY using Supadata with fallback to existing transcript methods
        
        Args:
            video_url: YouTube video URL
            bot_id: Bot ID for document processing
            lang: Preferred language for transcript (default: 'en')
            
        Returns:
            Dict containing processed transcript documents only (no captions, no metadata)
        """
        try:
            print(f"DEBUG: Attempting transcript-only extraction for: {video_url}")
            
            # First try Supadata
            supadata_result = await self.youtubeCalled(video_url, lang=lang, text=True, mode="auto")
            
            if supadata_result.get('success') and supadata_result.get('transcript'):
                print(f"DEBUG: Supadata transcript extraction successful")
                
                video_id = supadata_result['video_id']
                transcript_obj = supadata_result['transcript']
                
                # Convert Transcript object to string
                if hasattr(transcript_obj, 'text'):
                    transcript_text = transcript_obj.text
                elif hasattr(transcript_obj, '__str__'):
                    transcript_text = str(transcript_obj)
                else:
                    transcript_text = transcript_obj
                
                print(f"DEBUG: Transcript text type: {type(transcript_text)}, length: {len(str(transcript_text))}")
                
                # Ensure we have a string
                if not isinstance(transcript_text, str):
                    transcript_text = str(transcript_text)
                
                # Process transcript into documents (transcript only)
                documents = []
                words = transcript_text.split()
                chunk_size = 1024  # words per chunk
                
                for i in range(0, len(words), chunk_size):
                    chunk_words = words[i:i + chunk_size]
                    chunk_text = ' '.join(chunk_words)
                    chunk_index = i // chunk_size
                    
                    doc = {
                        'id': f"{video_id}_supadata_transcript_{chunk_index}",
                        'content': chunk_text,
                        'metadata': {
                            'source': video_url,
                            'chunk': chunk_index,
                            'page_number': None,
                            'extraction_time': datetime.now().isoformat(),
                            'context': f"YouTube Video Transcript - {video_id}",
                            'page_summary': f"Transcript segment {chunk_index+1} (words {i+1}-{min(i + chunk_size, len(words))})",
                            'keywords': f"video_id:{video_id},content_type:youtube_transcript,language:{lang},extraction_source:supadata,word_start:{i},word_end:{min(i + chunk_size, len(words))}",
                            'bot_id': bot_id,
                            'user_id': user_id
                        }
                    }
                    documents.append(doc)
                
                result = {
                    'success': True,
                    'video_id': video_id,
                    'video_url': video_url,
                    'bot_id': bot_id,
                    'processing_time': datetime.now().isoformat(),
                    'documents': documents,
                    'document_count': len(documents),
                    'extraction_source': 'supadata',
                    'content_type': 'transcript_only'
                }
                
                print(f"DEBUG: Supadata transcript processing complete - {len(documents)} transcript documents created")
                return result
            
            # Fallback to existing transcript methods only (no captions)
            print(f"DEBUG: Supadata extraction failed, falling back to existing transcript methods")
            print(f"DEBUG: Supadata error: {supadata_result.get('error', 'Unknown error')}")
            
            # Use existing get_full_transcript method
            video_id = self.extract_video_id(video_url)
            if not video_id:
                return {'success': False, 'error': 'Invalid YouTube URL'}
            
            transcript_data = await self.get_full_transcript(video_id)
            
            if transcript_data.get('text'):
                # Process transcript into documents
                documents = []
                transcript_text = transcript_data['text']
                words = transcript_text.split()
                chunk_size = 300  # words per chunk
                
                for i in range(0, len(words), chunk_size):
                    chunk_words = words[i:i + chunk_size]
                    chunk_text = ' '.join(chunk_words)
                    chunk_index = i // chunk_size
                    
                    doc = {
                        'id': f"{video_id}_fallback_transcript_{chunk_index}",
                        'content': chunk_text,
                        'metadata': {
                            'source': video_url,
                            'chunk': chunk_index,
                            'page_number': None,
                            'extraction_time': datetime.now().isoformat(),
                            'context': f"YouTube Video Transcript - {video_id}",
                            'page_summary': f"Transcript segment {chunk_index+1} (words {i+1}-{min(i + chunk_size, len(words))})",
                            'keywords': f"video_id:{video_id},content_type:youtube_transcript,language:{transcript_data.get('language', 'unknown')},extraction_source:fallback,word_start:{i},word_end:{min(i + chunk_size, len(words))}",
                            'bot_id': bot_id,
                            'user_id': user_id
                        }
                    }
                    documents.append(doc)
                
                result = {
                    'success': True,
                    'video_id': video_id,
                    'video_url': video_url,
                    'bot_id': bot_id,
                    'processing_time': datetime.now().isoformat(),
                    'documents': documents,
                    'document_count': len(documents),
                    'extraction_source': 'fallback_transcript',
                    'content_type': 'transcript_only',
                    'supadata_error': supadata_result.get('error', 'Supadata extraction failed')
                }
                
                print(f"DEBUG: Fallback transcript extraction successful - {len(documents)} documents created")
                return result
            else:
                return {
                    'success': False,
                    'error': 'No transcript available from any source',
                    'video_url': video_url,
                    'extraction_source': 'failed'
                }
            
        except Exception as e:
            logger.error(f"Error in youtubeCalled_transcript_only for {video_url}: {str(e)}")
            return {
                'success': False,
                'error': f'Transcript extraction failure: {str(e)}',
                'video_url': video_url,
                'extraction_source': 'failed'
            }