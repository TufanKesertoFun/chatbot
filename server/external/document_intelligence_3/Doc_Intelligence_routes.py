# Document_Intelligence_routes.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, Query, Path, Body
from fastapi.responses import StreamingResponse
from config import get_settings, Settings
from io import BytesIO
from typing import List, Optional, Dict, Any
from Managers.Document_Intelligence_3.Doc_Intelligence import DocumentIntelligence
from Managers.Document_Intelligence_3.Web_Intelligence import WebIntelligence
from pydantic import BaseModel
import aiohttp

router = APIRouter()

class WebContentRequest(BaseModel):
    markdown_content: str
    source: str
    bot_id: str
    user_id: Optional[str] = None
    id_prefix: Optional[str] = None
    page_number: int = 1
    processimages:bool

class WebScrapeRequest(BaseModel):
    url: str
    params: Optional[Dict[str, Any]] = None
    scraping_model: Optional[str] = "firecrawl" 
    

class ChunkMetadata(BaseModel):
    source: str
    chunk: int
    page_number: int
    extraction_time: str
    context: str
    page_summary: str
    keywords: str
    bot_id: str
    user_id: Optional[str] = None

class DocumentChunk(BaseModel):
    id: str
    content: str
    metadata: ChunkMetadata

async def get_document_intelligence_manager(settings: Settings = Depends(get_settings)):
    if not settings.document_intelligence_key or not settings.document_intelligence_endpoint:
        raise HTTPException(
            status_code=500,
            detail="Document Intelligence key or endpoint is not set",
        )
    return DocumentIntelligence(settings)

async def get_web_intelligence_manager(settings: Settings = Depends(get_settings)):
    if not settings.firecrawl_api_key:
        raise HTTPException(
            status_code=500,
            detail="Firecrawl API key is not set",
        )
    return WebIntelligence(settings)

@router.post("/analyze-and-split-from-blob/", response_model=List[DocumentChunk])
async def analyze_and_split_document_from_blob(
    container_name: str,
    blob_path: str,
    bot_id: str = Query(None, description="Bot ID associated with this document"),
    user_id: Optional[str] = Query(None, description="User ID for multi-tenancy filtering"),
    model: str = Query("prebuilt-layout", description="The Document Intelligence model to use"),
    split_by_headers: bool = Query(False, description="Whether to split the document by headers"),
    document_intelligence: DocumentIntelligence = Depends(get_document_intelligence_manager)
):
    """
    Analyze and optionally split a document from blob storage using Azure Document Intelligence
    
    Supported formats:
    - Document Intelligence: Images (JPEG/JPG, PNG, BMP, HEIF), PDF, TIFF, Word (DOCX), PowerPoint (PPTX), HTML
    - Custom Processing: CSV, Excel (XLSX, XLS)
    """
   # breakpoint()
    headers_to_split_on = None
    if split_by_headers:
        headers_to_split_on = [
            ("#", "Header 1"),
            ("##", "Header 2"),
            ("###", "Header 3"),
        ]
     
    result = await document_intelligence.analyze_and_split_document_from_blob(
        container_name, 
        blob_path, 
        model, 
        headers_to_split_on,
        bot_id,
        user_id
    )
    return result

@router.post("/scrape-url/")
async def scrape_url(
    request: WebScrapeRequest,
    web_intelligence: WebIntelligence = Depends(get_web_intelligence_manager)
):
    """Scrape a URL using Firecrawl SDK and return the markdown content"""
    result = await web_intelligence.scrape_url(request.url, request.params,request.scraping_model)
    return result

@router.post("/process-web-content/", response_model=List[DocumentChunk])
async def process_web_content(
    request: WebContentRequest,
    split_by_headers: bool = Query(False, description="Whether to split the content by headers"),
    use_semantic_chunking: bool = Query(False, description="Whether to use semantic chunking"),
    web_intelligence: WebIntelligence = Depends(get_web_intelligence_manager)
):

    print("i am here",request.markdown_content)
    """Process and split web content (markdown) using text splitters or semantic chunking"""
    print("the processimage is",request.processimages)
    if use_semantic_chunking:
        result = await web_intelligence.semantic_chunk_content(
            request.markdown_content,
            request.source,
            request.bot_id,
            request.user_id,
            request.id_prefix,
            request.page_number,
            request.processimages
        )
    else:
        headers_to_split_on = [
            ("#", "Header 1"),
            ("##", "Header 2"),
            ("###", "Header 3"),
        ] if split_by_headers else None

        result = await web_intelligence.process_web_content(
            request.markdown_content,
            request.source,
            request.bot_id,
            request.user_id,
            request.id_prefix,
            request.page_number,
            headers_to_split_on,
            request.processimages
        )
    
    return result

@router.get("/test-spreadsheet/")
async def test_spreadsheet_endpoint():
    """Test endpoint to verify the service is working"""
    import logging
    logger = logging.getLogger(__name__)
    logger.info("DEBUG: Test spreadsheet endpoint called")
    return {"message": "Spreadsheet endpoint is working", "status": "ok"}

@router.post("/process-spreadsheet/")
async def process_spreadsheet(
    container_name: str = Query(..., description="Container name"),
    blob_path: str = Query(..., description="Blob path"),
    bot_id: str = Query(..., description="Bot ID"),
    user_id: Optional[str] = Query(None, description="User ID for multi-tenancy filtering"),
    headers_to_split_on: Optional[bool] = Query(False, description="Whether to split by headers"),
    document_intelligence: DocumentIntelligence = Depends(get_document_intelligence_manager)
):
    """
    Process CSV and Excel files from blob storage
    
    Supported formats:
    - CSV files (.csv)
    - Excel files (.xlsx, .xls)
    
    Returns processed documents with metadata for embedding
    """
    try:
        import logging
        logger = logging.getLogger(__name__)
        
        # Debug logging
        logger.info(f"DEBUG: Received parameters - container_name: {container_name}, blob_path: {blob_path}, bot_id: {bot_id}, user_id: {user_id}, headers_to_split_on: {headers_to_split_on}")
        logger.info(f"DEBUG: About to call document_intelligence.process_spreadsheet_file")
        
        # Get file extension from blob path
        file_extension = blob_path.lower().split('.')[-1] if '.' in blob_path else ''
        
        if file_extension not in ['csv', 'xlsx', 'xls']:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format: {file_extension}. Only CSV, XLSX, and XLS files are supported."
            )
        
        # Process the spreadsheet file
        logger.info(f"DEBUG: Calling process_spreadsheet_file with container_name={container_name}, blob_path={blob_path}")
        result = await document_intelligence.process_spreadsheet_file(
            container_name=container_name,
            blob_path=blob_path,
            bot_id=bot_id,
            user_id=user_id,
            headers_to_split_on=headers_to_split_on
        )
        logger.info(f"DEBUG: process_spreadsheet_file completed, result count: {len(result) if result else 0}")
        
        return {"status": "success", "documents": result, "count": len(result)}
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing spreadsheet file: {str(e)}"
        )