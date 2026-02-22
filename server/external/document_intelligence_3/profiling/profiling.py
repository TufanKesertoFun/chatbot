"""
Reusable profiling utilities for Document Intelligence module.
Uses cProfile for CPU profiling and psutil/tracemalloc for memory.
No Django dependencies.
"""
import cProfile
import pstats
import tracemalloc
import psutil
import functools
import time
import logging
import os
from io import StringIO
from dataclasses import dataclass, asdict
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class ProfileResult:
    """Structured profiling result."""
    timestamp: str
    function_name: str
    app_name: str
    total_time_seconds: float
    function_calls: int
    memory_start_mb: float
    memory_end_mb: float
    memory_delta_mb: float
    top_functions: List[Dict[str, Any]]
    allocations_count: int = 0
    document_type: Optional[str] = None
    document_size_kb: Optional[float] = None
    pages_processed: Optional[int] = None


def get_memory_usage_mb() -> float:
    """Get current process memory usage in MB using psutil."""
    process = psutil.Process()
    return process.memory_info().rss / (1024 * 1024)


def get_top_function_info(profiler: cProfile.Profile) -> Tuple[str, float, int]:
    """Extract the slowest function and stats from profiler."""
    stream = StringIO()
    stats = pstats.Stats(profiler, stream=stream)
    stats.sort_stats('cumulative')

    total_calls = sum(stat[0] for stat in stats.stats.values()) if stats.stats else 0

    if stats.stats:
        # Get top function by cumulative time
        top_func = max(stats.stats.items(), key=lambda x: x[1][3])
        func_name = top_func[0][2]  # Function name
        cumtime_ms = top_func[1][3] * 1000  # Convert to ms
        return func_name, cumtime_ms, total_calls

    return "unknown", 0.0, total_calls


def store_profile_data(
    endpoint: str,
    method: str,
    app_name: str,
    time_ms: float,
    memory_start: float,
    memory_end: float,
    top_function: str,
    top_function_time: float,
    function_calls: int,
    user_id: Optional[int] = None,
    document_type: Optional[str] = None,
    document_size_kb: Optional[float] = None,
    pages_processed: Optional[int] = None
):
    """Store profile data using the database storage backend."""
    from .db_storage import get_db_storage

    record = {
        'app_name': app_name,
        'endpoint': endpoint,
        'method': method,
        'response_time_ms': time_ms,
        'function_calls': function_calls,
        'memory_start_mb': memory_start,
        'memory_end_mb': memory_end,
        'memory_delta_mb': memory_end - memory_start,
        'top_function': top_function[:255] if top_function else '',
        'top_function_time_ms': top_function_time,
        'user_id': user_id,
        'document_type': document_type,
        'document_size_kb': document_size_kb,
        'pages_processed': pages_processed
    }

    try:
        storage = get_db_storage()
        storage.store_record(record)
    except Exception as e:
        logger.error(f"Failed to store profiling data: {e}")


def is_profiling_enabled() -> bool:
    """Check if profiling is enabled via settings or environment variable."""
    try:
        from config import get_settings
        settings = get_settings()
        return settings.PROFILING_ENABLED
    except Exception:
        # Fallback to environment variable
        return os.getenv('PROFILING_ENABLED', 'false').lower() == 'true'


def is_memory_profiling_enabled() -> bool:
    """Check if memory profiling is enabled via settings or environment variable."""
    try:
        from config import get_settings
        settings = get_settings()
        return settings.PROFILING_MEMORY_ENABLED
    except Exception:
        # Fallback to environment variable
        return os.getenv('PROFILING_MEMORY_ENABLED', 'false').lower() == 'true'


def get_min_time_threshold() -> float:
    """Get minimum time threshold for storing profiles."""
    try:
        from config import get_settings
        settings = get_settings()
        return float(settings.PROFILING_MIN_TIME_MS)
    except Exception:
        # Fallback to environment variable
        return float(os.getenv('PROFILING_MIN_TIME_MS', '100'))


def profile_cpu(output_file: Optional[str] = None, app_name: str = 'document_intelligence'):
    """Decorator to profile CPU usage using cProfile."""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            if not is_profiling_enabled():
                return func(*args, **kwargs)

            profiler = cProfile.Profile()
            profiler.enable()
            try:
                result = func(*args, **kwargs)
            finally:
                profiler.disable()

                # Log stats
                stream = StringIO()
                stats = pstats.Stats(profiler, stream=stream)
                stats.sort_stats('cumulative')
                stats.print_stats(10)
                logger.debug(f"Profile for {func.__name__}:\n{stream.getvalue()}")

            return result
        return wrapper
    return decorator


def profile_memory(output_file: Optional[str] = None, app_name: str = 'document_intelligence'):
    """Decorator to profile memory using psutil + tracemalloc."""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            if not is_memory_profiling_enabled():
                return func(*args, **kwargs)

            tracemalloc.start()
            mem_before = get_memory_usage_mb()
            try:
                result = func(*args, **kwargs)
            finally:
                mem_after = get_memory_usage_mb()
                current, peak = tracemalloc.get_traced_memory()
                tracemalloc.stop()

                logger.debug(
                    f"Memory profile for {func.__name__}: "
                    f"before={mem_before:.2f}MB, after={mem_after:.2f}MB, "
                    f"delta={mem_after - mem_before:.2f}MB, peak={peak / (1024 * 1024):.2f}MB"
                )

            return result
        return wrapper
    return decorator


def profile_endpoint(
    name: Optional[str] = None,
    app_name: str = 'document_intelligence',
    save_to_storage: bool = True,
    document_type: Optional[str] = None
):
    """Combined CPU + memory profiling decorator for Document Intelligence functions (sync and async)."""
    def decorator(func):
        # Check if function is async
        import asyncio
        is_async = asyncio.iscoroutinefunction(func)

        if is_async:
            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                if not is_profiling_enabled():
                    return await func(*args, **kwargs)

                memory_enabled = is_memory_profiling_enabled()

                # Start profiling
                start_time = time.perf_counter()
                mem_before = get_memory_usage_mb() if memory_enabled else 0

                if memory_enabled:
                    tracemalloc.start()

                profiler = cProfile.Profile()
                profiler.enable()

                try:
                    result = await func(*args, **kwargs)
                finally:
                    profiler.disable()
                    elapsed_ms = (time.perf_counter() - start_time) * 1000

                    # Calculate memory
                    mem_after = 0
                    if memory_enabled:
                        mem_after = get_memory_usage_mb()
                        try:
                            tracemalloc.stop()
                        except Exception:
                            pass

                    # Get function info
                    top_function, top_func_time, func_calls = get_top_function_info(profiler)

                    # Extract metadata from function arguments and result
                    extra_metadata = {}

                    # Try to extract document size from arguments
                    if 'file_content' in kwargs:
                        extra_metadata['document_size_kb'] = len(kwargs['file_content']) / 1024
                    elif len(args) > 1 and isinstance(args[1], bytes):
                        extra_metadata['document_size_kb'] = len(args[1]) / 1024

                    # Try to extract document type from file_name
                    if 'file_name' in kwargs:
                        file_name = kwargs['file_name']
                        if '.' in file_name:
                            ext = file_name.lower().split('.')[-1]
                            if not document_type:
                                extra_metadata['document_type'] = ext
                    elif len(args) > 2 and isinstance(args[2], str):
                        file_name = args[2]
                        if '.' in file_name:
                            ext = file_name.lower().split('.')[-1]
                            if not document_type:
                                extra_metadata['document_type'] = ext

                    # Try to extract pages from result
                    if isinstance(result, dict):
                        if 'total_pages' in result:
                            extra_metadata['pages_processed'] = result['total_pages']
                        elif 'page_count' in result:
                            extra_metadata['pages_processed'] = result['page_count']
                    elif hasattr(result, 'pages'):
                        # Document Intelligence result object
                        try:
                            extra_metadata['pages_processed'] = len(result.pages) if result.pages else 0
                        except:
                            pass

                    # Store if above threshold
                    if save_to_storage and elapsed_ms >= get_min_time_threshold():
                        store_profile_data(
                            endpoint=name or func.__name__,
                            method='DECORATOR',
                            app_name=app_name,
                            time_ms=elapsed_ms,
                            memory_start=mem_before,
                            memory_end=mem_after,
                            top_function=top_function,
                            top_function_time=top_func_time,
                            function_calls=func_calls,
                            document_type=document_type or extra_metadata.get('document_type'),
                            document_size_kb=extra_metadata.get('document_size_kb'),
                            pages_processed=extra_metadata.get('pages_processed')
                        )

                    logger.debug(
                        f"Profile for {name or func.__name__}: "
                        f"time={elapsed_ms:.2f}ms, calls={func_calls}, "
                        f"memory_delta={mem_after - mem_before:.2f}MB"
                    )

                return result
            return async_wrapper
        else:
            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs):
                if not is_profiling_enabled():
                    return func(*args, **kwargs)

                memory_enabled = is_memory_profiling_enabled()

                # Start profiling
                start_time = time.perf_counter()
                mem_before = get_memory_usage_mb() if memory_enabled else 0

                if memory_enabled:
                    tracemalloc.start()

                profiler = cProfile.Profile()
                profiler.enable()

                try:
                    result = func(*args, **kwargs)
                finally:
                    profiler.disable()
                    elapsed_ms = (time.perf_counter() - start_time) * 1000

                    # Calculate memory
                    mem_after = 0
                    if memory_enabled:
                        mem_after = get_memory_usage_mb()
                        try:
                            tracemalloc.stop()
                        except Exception:
                            pass

                    # Get function info
                    top_function, top_func_time, func_calls = get_top_function_info(profiler)

                    # Extract metadata from function arguments and result
                    extra_metadata = {}

                    # Try to extract document size from arguments
                    if 'file_content' in kwargs:
                        extra_metadata['document_size_kb'] = len(kwargs['file_content']) / 1024
                    elif len(args) > 1 and isinstance(args[1], bytes):
                        extra_metadata['document_size_kb'] = len(args[1]) / 1024

                    # Try to extract document type from file_name
                    if 'file_name' in kwargs:
                        file_name = kwargs['file_name']
                        if '.' in file_name:
                            ext = file_name.lower().split('.')[-1]
                            if not document_type:
                                extra_metadata['document_type'] = ext
                    elif len(args) > 2 and isinstance(args[2], str):
                        file_name = args[2]
                        if '.' in file_name:
                            ext = file_name.lower().split('.')[-1]
                            if not document_type:
                                extra_metadata['document_type'] = ext

                    # Try to extract pages from result
                    if isinstance(result, dict):
                        if 'total_pages' in result:
                            extra_metadata['pages_processed'] = result['total_pages']
                        elif 'page_count' in result:
                            extra_metadata['pages_processed'] = result['page_count']
                    elif hasattr(result, 'pages'):
                        # Document Intelligence result object
                        try:
                            extra_metadata['pages_processed'] = len(result.pages) if result.pages else 0
                        except:
                            pass

                    # Store if above threshold
                    if save_to_storage and elapsed_ms >= get_min_time_threshold():
                        store_profile_data(
                            endpoint=name or func.__name__,
                            method='DECORATOR',
                            app_name=app_name,
                            time_ms=elapsed_ms,
                            memory_start=mem_before,
                            memory_end=mem_after,
                            top_function=top_function,
                            top_function_time=top_func_time,
                            function_calls=func_calls,
                            document_type=document_type or extra_metadata.get('document_type'),
                            document_size_kb=extra_metadata.get('document_size_kb'),
                            pages_processed=extra_metadata.get('pages_processed')
                        )

                    logger.debug(
                        f"Profile for {name or func.__name__}: "
                        f"time={elapsed_ms:.2f}ms, calls={func_calls}, "
                        f"memory_delta={mem_after - mem_before:.2f}MB"
                    )

                return result
            return sync_wrapper
    return decorator


class Profiler:
    """Context manager for inline profiling."""

    def __init__(
        self,
        name: str,
        app_name: str = 'document_intelligence',
        save_to_storage: bool = True,
        document_type: Optional[str] = None,
        document_size_kb: Optional[float] = None,
        pages_processed: Optional[int] = None
    ):
        self.name = name
        self.app_name = app_name
        self.save_to_storage = save_to_storage
        self.document_type = document_type
        self.document_size_kb = document_size_kb
        self.pages_processed = pages_processed
        self.result: Optional[ProfileResult] = None
        self._profiler: Optional[cProfile.Profile] = None
        self._start_time: float = 0
        self._mem_before: float = 0
        self._memory_enabled: bool = False
        self._enabled: bool = False

    def __enter__(self):
        self._enabled = is_profiling_enabled()
        if not self._enabled:
            return self

        self._memory_enabled = is_memory_profiling_enabled()

        self._start_time = time.perf_counter()
        self._mem_before = get_memory_usage_mb() if self._memory_enabled else 0

        if self._memory_enabled:
            tracemalloc.start()

        self._profiler = cProfile.Profile()
        self._profiler.enable()

        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if not self._enabled:
            return False

        if self._profiler:
            self._profiler.disable()

        elapsed_ms = (time.perf_counter() - self._start_time) * 1000

        mem_after = 0
        if self._memory_enabled:
            mem_after = get_memory_usage_mb()
            try:
                tracemalloc.stop()
            except Exception:
                pass

        top_function, top_func_time, func_calls = get_top_function_info(self._profiler)

        self.result = ProfileResult(
            timestamp=datetime.now().isoformat(),
            function_name=self.name,
            app_name=self.app_name,
            total_time_seconds=elapsed_ms / 1000,
            function_calls=func_calls,
            memory_start_mb=self._mem_before,
            memory_end_mb=mem_after,
            memory_delta_mb=mem_after - self._mem_before,
            top_functions=[{'name': top_function, 'time_ms': top_func_time}],
            document_type=self.document_type,
            document_size_kb=self.document_size_kb,
            pages_processed=self.pages_processed
        )

        if self.save_to_storage and elapsed_ms >= get_min_time_threshold():
            store_profile_data(
                endpoint=self.name,
                method='CONTEXT',
                app_name=self.app_name,
                time_ms=elapsed_ms,
                memory_start=self._mem_before,
                memory_end=mem_after,
                top_function=top_function,
                top_function_time=top_func_time,
                function_calls=func_calls,
                document_type=self.document_type,
                document_size_kb=self.document_size_kb,
                pages_processed=self.pages_processed
            )

        return False  # Don't suppress exceptions
