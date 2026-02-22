import os
from azure.cognitiveservices.vision.computervision import ComputerVisionClient
from msrest.authentication import CognitiveServicesCredentials
from fastapi import Depends, HTTPException, Query
from concurrent.futures import ThreadPoolExecutor
from config import get_settings, Settings
import traceback
import asyncio
import re
import aiohttp
import datetime
import uuid
from langchain.text_splitter import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter
from langchain.schema import Document
from typing import List
import redis
import json
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from logging_config import get_logger

# Module logger
logger = get_logger(__name__)

# Global thread pool for CPU-bound tasks
executor = ThreadPoolExecutor(max_workers=max(os.cpu_count(), 4))

class WebIntelligence:
    def __init__(self, settings: Settings = Depends(get_settings)):
        logger.debug("Initializing WebIntelligence manager")

        # Firecrawl API setup
        self.firecrawl_api_key = settings.firecrawl_api_key
        self.firecrawl_api_url = "https://api.firecrawl.dev/v1/scrape"
        
        # Jina API setup
        self.jina_api_key = settings.JINA_API_KEY
        self.jina_base_url = "https://r.jina.ai/"
        
        # Azure AI Vision setup
        self.vision_key = settings.VISION_KEY
        self.vision_endpoint = settings.VISION_ENDPOINT
        self.vision_client = ComputerVisionClient(self.vision_endpoint, CognitiveServicesCredentials(self.vision_key)) if self.vision_key and self.vision_endpoint else None
        
        # Initialize Redis client with the REDIS_URL from environment
        self.redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
        
        # Test Redis connection
        try:
            if self.redis_client.ping():
                logger.info("Successfully connected to Redis")
        except redis.ConnectionError as e:
            logger.error(
                f"Failed to connect to Redis",
                exc_info=True,
                extra={'custom_dimensions': {'error': str(e)}}
            )
            raise HTTPException(status_code=500, detail="Failed to connect to Redis cache")

        logger.info("WebIntelligence manager initialized successfully")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type((aiohttp.ClientTimeout, asyncio.TimeoutError)),
        before_sleep=lambda retry_state: logger.debug(f"Retrying scrape_url attempt {retry_state.attempt_number}...")
    )
    async def scrape_url(self, url, params=None, scraping_model="firecrawl"):
        """Scrape a URL using either Jina or Firecrawl API based on scraping_model parameter"""
        logger.debug("the model is:",scraping_model)
        if scraping_model.lower() == "jina":
            return await self._scrape_with_jina(url, params)
        elif scraping_model.lower() == "firecrawl":
            return await self._scrape_with_firecrawl(url, params)
        else:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported scraping model: {scraping_model}. Supported models: 'jina', 'firecrawl'"
            )

    async def _scrape_with_jina(self, url, params=None):
        """Scrape a URL using Jina API asynchronously with aiohttp"""
        try:
            # Jina URL format: https://r.jina.ai/{target_url}
            jina_url = f"{self.jina_base_url}{url}"
            
            # Set up headers
            headers = {
                "User-Agent": "Mozilla/5.0 (compatible; JinaBot/1.0)",
                "Accept": "text/plain, application/json"
            }
            
            # Add API key if available
            if self.jina_api_key:
                headers["Authorization"] = f"Bearer {self.jina_api_key}"
            
            logger.debug(f"Starting Jina scraping for: {url}")
            
            # Make async HTTP request to Jina API
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    jina_url,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=300)
                ) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        raise HTTPException(
                            status_code=response.status,
                            detail=f"Jina API error: {error_text}"
                        )
                    
                    # Get the response content type
                    content_type = response.headers.get('content-type', '').lower()
                    
                    if 'application/json' in content_type:
                        # JSON response
                        scrape_result = await response.json()
                        markdown_content = scrape_result.get('content', '')
                        title = scrape_result.get('title', '')
                    else:
                        # Plain text response (markdown)
                        markdown_content = await response.text()
                        # Extract title from markdown (first heading)
                        title_match = re.search(r'^#\s+(.+)$', markdown_content, re.MULTILINE)
                        title = title_match.group(1) if title_match else ""

            # Validate that we have content
            if not markdown_content or markdown_content.strip() == "":
                raise HTTPException(
                    status_code=422,
                    detail="No content found in scrape result"
                )

            return {
                "markdown": markdown_content,
                "title": title,
                "url": url,
                "scraping_model": "jina"
            }

        except Exception as e:
            logger.debug(f"Jina API request failed for URL {url}: {str(e)}")
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Jina API request failed: {str(e)}")

    async def _scrape_with_firecrawl(self, url, params=None):
        """Scrape a URL using Firecrawl API asynchronously with aiohttp"""
        try:
            # Use default parameters if none provided
            default_params = {'formats': ['markdown', 'html']}
            request_params = params if params else default_params
            request_params['url'] = url  # Add the URL to the payload

            # Set up headers with the API key
            headers = {"Authorization": f"Bearer {self.firecrawl_api_key}"}
            logger.debug(f"Starting Firecrawl scraping for: {url}")
            
            # Make async HTTP request to Firecrawl API
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.firecrawl_api_url,
                    json=request_params,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=300)
                ) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        raise HTTPException(
                            status_code=response.status,
                            detail=f"Firecrawl API error: {error_text}"
                        )
                    scrape_result = await response.json()

            # Check if markdown content is available
            if "markdown" not in scrape_result["data"]:
                raise HTTPException(
                    status_code=422,
                    detail="No markdown content found in scrape result"
                )
            scrape_result = scrape_result["data"]
            return {
                "markdown": scrape_result["markdown"],
                "title": scrape_result.get("title", ""),
                "url": url,
                "scraping_model": "firecrawl"
            }

        except Exception as e:
            logger.debug(f"Firecrawl API request failed for URL {url}: {str(e)}")
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Firecrawl API request failed: {str(e)}")

    async def scrape_url_with_selector(self, url, selector=None):
        """Scrape a URL using Jina API with optional CSS selector"""
        try:
            # Jina URL with selector parameter
            jina_url = f"{self.jina_base_url}{url}"
            
            headers = {
                "User-Agent": "Mozilla/5.0 (compatible; JinaBot/1.0)",
                "Accept": "text/plain, application/json"
            }
            
            if self.jina_api_key:
                headers["Authorization"] = f"Bearer {self.jina_api_key}"
            
            # Add selector as query parameter if provided
            params = {}
            if selector:
                params["selector"] = selector
            
            logger.debug(f"Starting Jina scraping with selector for: {url}")
            
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    jina_url,
                    headers=headers,
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=300)
                ) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        raise HTTPException(
                            status_code=response.status,
                            detail=f"Jina API error: {error_text}"
                        )
                    
                    content_type = response.headers.get('content-type', '').lower()
                    
                    if 'application/json' in content_type:
                        scrape_result = await response.json()
                        markdown_content = scrape_result.get('content', '')
                        title = scrape_result.get('title', '')
                    else:
                        markdown_content = await response.text()
                        title_match = re.search(r'^#\s+(.+)$', markdown_content, re.MULTILINE)
                        title = title_match.group(1) if title_match else ""

            return {
                "markdown": markdown_content,
                "title": title,
                "url": url
            }

        except Exception as e:
            logger.debug(f"Jina API request with selector failed for URL {url}: {str(e)}")
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Jina API request failed: {str(e)}")

    async def analyze_image(self, image_url):
        """Analyze an image using Azure AI Vision with Redis caching"""
        if not self.vision_client:
            return {"error": "Azure AI Vision not configured"}

        # Check if image analysis is in Redis cache
        try:
            cached_result = self.redis_client.get(image_url)
            if cached_result:
                logger.debug(f"Using cached analysis for {image_url}")
                return json.loads(cached_result)
        except redis.RedisError as e:
            logger.debug(f"Redis cache read failed for {image_url}: {str(e)}")
            # Proceed to analyze without cache if Redis fails

        try:
            tags_result = self.vision_client.tag_image(image_url)
            product_tags = [tag.name for tag in tags_result.tags]
            describe_result = self.vision_client.describe_image(image_url)
            caption = describe_result.captions[0].text if describe_result.captions else "No caption available"
            analysis_result = {
                "tags": product_tags,
                "caption": caption,
                "image_url": image_url
            }
            # Cache the result in Redis with a 24-hour expiry
            try:
                self.redis_client.setex(image_url, 86400, json.dumps(analysis_result))
                logger.debug("Image cache updated in Redis")
            except redis.RedisError as e:
                logger.debug(f"Redis cache write failed for {image_url}: {str(e)}")
            return analysis_result
        except Exception as e:
            # Cache the error result to avoid reprocessing
            error_result = {"error": str(e), "image_url": image_url}
            try:
                self.redis_client.setex(image_url, 86400, json.dumps(error_result))
                logger.debug(f"Image analysis failed for {image_url}, cached error in Redis")
            except redis.RedisError as e:
                logger.debug(f"Redis cache write failed for {image_url}: {str(e)}")
            return error_result

    async def semantic_chunk_content(self, content, source, bot_id, user_id=None, id_prefix=None, page_number=1, processimages=False):
        """Use semantic chunking to split content based on topic shifts, including image analysis"""
        try:
            if not id_prefix:
                id_prefix = f"web_{uuid.uuid4().hex[:8]}"

            # Detect image URLs in markdown content before chunking
            image_pattern = r"!\[.*?\]\((https?://[^\s]+(\.jpg|\.jpeg|\.png|\.gif))\)"
            image_urls = re.findall(image_pattern, content)
            logger.debug("image urls found in semantic chunking:", image_urls)
            image_analyses = {}
            if image_urls and self.vision_client and processimages:
                tasks = [self.analyze_image(url[0]) for url in image_urls]
                image_analyses = dict(zip([url[0] for url in image_urls], await asyncio.gather(*tasks)))
                logger.debug("image analysis found in semantic chunking:", image_analyses)

            from Managers.Document_Intelligence_3.semantic_chunker import process_content_to_json
            loop = asyncio.get_running_loop()
            chunks = await loop.run_in_executor(
                executor,
                process_content_to_json,
                content,
                source,
                bot_id,
                id_prefix,
                page_number
            )

            # Update chunks with image analysis
            updated_chunks = []
            for chunk in chunks:
                chunk_content = chunk["content"]
                image_data = {}
                for img_url, analysis in image_analyses.items():
                    if img_url in chunk_content:
                        image_data = analysis if "error" not in analysis else {}
                chunk["metadata"]["image_analysis"] = image_data
                updated_chunks.append(chunk)

            formatted_chunks = await asyncio.gather(
                *[self._format_chunk(chunk, user_id) for chunk in updated_chunks]
            )
            return formatted_chunks
        except Exception as e:
            logger.debug(f"Semantic chunking failed: {str(e)}")
            traceback.print_exc()
            return await self.process_web_content(content, source, bot_id, user_id, id_prefix, page_number)

    async def process_web_content(self, markdown_content, source, bot_id, user_id=None, id_prefix=None, page_number=1, headers_to_split_on=None, processimages=False):
        """Process and split web content (markdown) using text splitters"""
        try:
            if not id_prefix:
                id_prefix = f"web_{uuid.uuid4().hex[:8]}"
            
            loop = asyncio.get_running_loop()
            if headers_to_split_on:
                text_splitter = MarkdownHeaderTextSplitter(headers_to_split_on=headers_to_split_on)
                splits = await loop.run_in_executor(executor, text_splitter.split_text, markdown_content)
            else:
                text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
                doc = Document(
                    page_content=markdown_content,
                    metadata={
                        "source": source,
                        "page_number": page_number,
                        "bot_id": bot_id,
                        "user_id": user_id,
                        "extraction_time": datetime.datetime.now().isoformat()
                    }
                )
                splits = await loop.run_in_executor(executor, text_splitter.split_documents, [doc])
            
            # Detect image URLs in markdown content
            image_pattern = r"!\[.*?\]\((https?://[^\s]+(\.jpg|\.jpeg|\.png|\.gif))\)"
            image_urls = re.findall(image_pattern, markdown_content)
            logger.debug("image urls found:", image_urls)
            image_analyses = {}
            if image_urls and self.vision_client and processimages:
                tasks = [self.analyze_image(url[0]) for url in image_urls]
                image_analyses = dict(zip([url[0] for url in image_urls], await asyncio.gather(*tasks)))
                logger.debug("image analysis found:", image_analyses)

            # Process splits concurrently
            all_splits = await asyncio.gather(
                *[self._process_split(split, id_prefix, i, source, page_number, bot_id, user_id, image_analyses) for i, split in enumerate(splits)]
            )
            return all_splits if all_splits else await self._fallback(markdown_content, source, bot_id, user_id, id_prefix, page_number)

        except Exception as e:
            logger.debug(f"Web content processing failed: {str(e)}")
            traceback.print_exc()
            return await self._fallback(markdown_content, source, bot_id, user_id, id_prefix, page_number)

    async def _process_split(self, split, id_prefix, index, source, page_number, bot_id, user_id, image_analyses):
        """Process a single split asynchronously with image analysis"""
        loop = asyncio.get_running_loop()
        content = split.page_content if hasattr(split, 'metadata') else split
        try:
            from Managers.Document_Intelligence_3.semantic_chunker import extract_keywords
            keywords = await loop.run_in_executor(executor, extract_keywords, content)
        except Exception:
            keywords = []

        # Associate image analysis with this chunk if relevant
        image_data = {}
        for img_url, analysis in image_analyses.items():
            if img_url in content:
                image_data = analysis if "error" not in analysis else {}

        return {
            "id": f"{id_prefix}_{index}",
            "content": content,
            "metadata": {
                "source": source,
                "chunk": index + 1,
                "page_number": page_number,
                "extraction_time": datetime.datetime.now().isoformat(),
                "context": "header section" if hasattr(split, 'metadata') and 'header' in split.metadata else "text chunk",
                "page_summary": "",
                "keywords": ", ".join(keywords),
                "bot_id": bot_id,
                "user_id": user_id,
                "image_analysis": image_data
            }
        }

    async def _fallback(self, markdown_content, source, bot_id, user_id, id_prefix, page_number):
        """Fallback processing for failed splits"""
        loop = asyncio.get_running_loop()
        try:
            from Managers.Document_Intelligence_3.semantic_chunker import extract_keywords
            keywords = await loop.run_in_executor(executor, extract_keywords, markdown_content)
        except Exception:
            keywords = []
        
        return [{
            "id": id_prefix,
            "content": markdown_content,
            "metadata": {
                "source": source,
                "chunk": 1,
                "page_number": page_number,
                "extraction_time": datetime.datetime.now().isoformat(),
                "context": "web content",
                "page_summary": "",
                "keywords": ", ".join(keywords),
                "bot_id": bot_id,
                "user_id": user_id
            }
        }]

    async def _format_chunk(self, chunk, user_id):
        """Format a semantic chunk, ensuring image_analysis is included"""
        return {
            "id": chunk["id"],
            "content": chunk["content"],
            "metadata": {
                "source": chunk["metadata"]["source"],
                "chunk": chunk["metadata"]["chunk"],
                "page_number": chunk["metadata"]["page_number"],
                "extraction_time": chunk["metadata"]["extraction_time"],
                "context": chunk["metadata"]["context"],
                "page_summary": chunk["metadata"]["page_summary"],
                "keywords": chunk["metadata"]["keywords"],
                "bot_id": chunk["metadata"]["bot_id"],
                "user_id": user_id,
                "image_analysis": chunk["metadata"].get("image_analysis", {})  # Include image_analysis
            }
        }