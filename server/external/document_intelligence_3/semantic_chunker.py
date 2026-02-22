# semantic_chunker.py
import re
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional

# Initialize NLTK availability flag
NLTK_AVAILABLE = False

try:
    import nltk
    from nltk.tokenize import sent_tokenize, word_tokenize
    from nltk.corpus import stopwords
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    nltk.download('punkt_tab')
    nltk.download('stopwords')
    NLTK_AVAILABLE = True
except ImportError:
    # NLTK or its dependencies are not available
    pass

def semantic_chunker(
    content: str, 
    max_chunk_size: int = 1000, 
    min_chunk_size: int = 200, 
    source: str = "default", 
    bot_id: Optional[str] = None,
    user_id: Optional[str] = None,
    id_prefix: Optional[str] = None,
    page_number: int = 1,
    extraction_time: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Break content into semantically meaningful chunks based on topic shifts.
    
    Args:
        content: The text content to be chunked
        max_chunk_size: Maximum chunk size in characters (default: 1000)
        min_chunk_size: Minimum chunk size in characters (default: 200)
        source: Source of the content (default: "default")
        bot_id: ID of the bot processing this content (default: derived from source)
        user_id: ID of the user associated with this content (default: None)
        id_prefix: Prefix for chunk IDs (default: derived from source)
        page_number: Page number of the content (default: 1)
        extraction_time: Extraction timestamp (default: current UTC time)
        
    Returns:
        List of dictionaries containing chunked content with metadata
    """
    # Set default values for optional parameters
    if extraction_time is None:
        extraction_time = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    
    if bot_id is None:
        bot_id = f"{re.sub(r'[^a-z0-9-]', '', source.lower())}-bot"
    
    if id_prefix is None:
        id_prefix = re.sub(r'[^a-z0-9-]', '', source.lower())
    
    # Clean the content - remove excessive whitespace
    content = re.sub(r'\n{3,}', '\n\n', content)
    
    # First split by obvious section breaks - headers
    header_pattern = r'(?<!\n)(^|\n)(?:#{1,6} |## )'
    section_candidates = re.split(header_pattern, content)
    
    # Clean empty sections
    section_candidates = [s.strip() for s in section_candidates if s.strip()]
    
    # Process section candidates to respect size limits
    chunks = []
    current_chunk = ""
    
    for section in section_candidates:
        # If adding this section exceeds max size and current chunk is not empty,
        # finalize current chunk
        if len(current_chunk) + len(section) > max_chunk_size and len(current_chunk) >= min_chunk_size:
            chunks.append(current_chunk.strip())
            current_chunk = section
        # If this section alone exceeds max size, split it further
        elif len(section) > max_chunk_size:
            if current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = ""
            
            # Split large sections by paragraphs
            paragraphs = section.split('\n\n')
            temp_chunk = ""
            
            for para in paragraphs:
                if len(temp_chunk) + len(para) > max_chunk_size and len(temp_chunk) >= min_chunk_size:
                    chunks.append(temp_chunk.strip())
                    temp_chunk = para
                else:
                    if temp_chunk:
                        temp_chunk += "\n\n"
                    temp_chunk += para
            
            if temp_chunk:
                current_chunk = temp_chunk
        else:
            if current_chunk:
                current_chunk += "\n\n"
            current_chunk += section
    
    # Add the last chunk if not empty
    if current_chunk:
        chunks.append(current_chunk.strip())
    
    # Further analyze semantic coherence of chunks if NLTK is available
    if NLTK_AVAILABLE:
        chunks = optimize_chunk_coherence(chunks, max_chunk_size, min_chunk_size)
    
    # Generate JSON output with metadata
    result = []
    for i, chunk in enumerate(chunks):
        # Extract keywords if NLTK is available
        keywords = extract_keywords(chunk) if NLTK_AVAILABLE else []
        
        # Create unique ID for the chunk
        chunk_id = f"{id_prefix}-{str(uuid.uuid4())[:8]}"
        
        # Create metadata dictionary with user_id only if provided
        metadata = {
            "source": source,
            "chunk": i + 1,
            "page_number": page_number,
            "extraction_time": extraction_time,
            "context": "content chunk",
            "page_summary": "",
            "keywords": ", ".join(keywords),
            "bot_id": bot_id
        }
        
        # Add user_id to metadata if provided
        if user_id is not None:
            metadata["user_id"] = user_id
        
        # Create JSON entry
        chunk_data = {
            "id": chunk_id,
            "content": chunk,
            "metadata": metadata
        }
        result.append(chunk_data)
    
    return result

def optimize_chunk_coherence(chunks: List[str], max_size: int, min_size: int) -> List[str]:
    """
    Optimize chunks for semantic coherence by potentially merging or splitting them
    based on topic similarity.
    """
    if len(chunks) <= 1:
        return chunks
    
    # Calculate similarity between adjacent chunks
    vectorizer = TfidfVectorizer(stop_words='english')
    try:
        tfidf_matrix = vectorizer.fit_transform(chunks)
        similarity_matrix = cosine_similarity(tfidf_matrix)
        
        optimized_chunks = []
        i = 0
        
        while i < len(chunks):
            current_chunk = chunks[i]
            
            # Check if we can merge with next chunk
            if i < len(chunks) - 1:
                next_chunk = chunks[i + 1]
                similarity = similarity_matrix[i, i + 1]
                
                # If very similar and combined size isn't too large, merge them
                if similarity > 0.6 and len(current_chunk) + len(next_chunk) <= max_size:
                    optimized_chunks.append(f"{current_chunk}\n\n{next_chunk}")
                    i += 2
                    continue
            
            optimized_chunks.append(current_chunk)
            i += 1
        
        return optimized_chunks
    
    except ValueError:
        # Fallback if vectorization fails
        return chunks

def extract_keywords(text: str, num_keywords: int = 8) -> List[str]:
    """Extract important keywords from the text."""
    if not NLTK_AVAILABLE:
        return []
        
    # Simple keyword extraction using term frequency
    words = word_tokenize(text.lower())
    stop_words = set(stopwords.words('english'))
    
    # Filter stopwords and non-alphabetic words
    filtered_words = [word for word in words if word.isalpha() and word not in stop_words and len(word) > 3]
    
    # Count word frequencies
    word_freq = {}
    for word in filtered_words:
        if word in word_freq:
            word_freq[word] += 1
        else:
            word_freq[word] = 1
    
    # Sort by frequency and return top keywords
    sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
    return [word for word, freq in sorted_words[:num_keywords]]

def process_content_to_json(
    content: str, 
    source: str = "default",
    bot_id: Optional[str] = None,
    user_id: Optional[str] = None,
    id_prefix: Optional[str] = None,
    page_number: int = 1,
    max_chunk_size: int = 1000,
    min_chunk_size: int = 200
) -> List[Dict[str, Any]]:
    """
    Process content and return JSON-ready chunks.
    
    Args:
        content: The text content to process
        source: The source of the content
        bot_id: ID of the bot processing this content
        user_id: ID of the user associated with this content
        id_prefix: Prefix for chunk IDs
        page_number: Page number of the content
        max_chunk_size: Maximum chunk size in characters
        min_chunk_size: Minimum chunk size in characters
        
    Returns:
        List of dictionaries containing chunked content with metadata
    """
    # Check if NLTK dependencies are available and try to download if needed
    global NLTK_AVAILABLE
    if not NLTK_AVAILABLE:
        try:
            # Try to download required NLTK resources
            nltk.download('punkt')
            nltk.download('stopwords')
            
            # Re-check imports
            from nltk.tokenize import sent_tokenize, word_tokenize
            from nltk.corpus import stopwords
            
            NLTK_AVAILABLE = True
            print("NLTK resources downloaded successfully.")
        except Exception as e:
            print(f"Could not set up NLTK: {str(e)}")
            # Continue without NLTK
    
    # Process content into semantically meaningful chunks
    chunks = semantic_chunker(
        content=content, 
        source=source,
        bot_id=bot_id,
        user_id=user_id,
        id_prefix=id_prefix,
        page_number=page_number,
        max_chunk_size=max_chunk_size,
        min_chunk_size=min_chunk_size
    )
    
    return chunks