"""
Analyzes profiling data to identify problematic Document Intelligence endpoints.
No Django dependencies.
"""
import logging
import os
from dataclasses import dataclass
from typing import List, Tuple, Dict, Any
from collections import defaultdict

logger = logging.getLogger(__name__)


@dataclass
class ProblematicEndpoint:
    """Represents an endpoint that exceeded thresholds."""
    severity: str  # CRITICAL, HIGH, MEDIUM
    app_name: str
    endpoint: str
    method: str
    issue_type: str  # SLOW_RESPONSE, HIGH_MEMORY, P95_EXCEEDED
    metric_value: float
    threshold: float
    total_requests: int
    avg_time_ms: float
    p95_time_ms: float
    peak_memory_mb: float
    top_slow_function: str
    document_type: str = 'N/A'
    avg_document_size_kb: float = 0.0
    avg_pages_processed: float = 0.0


class DocumentIntelligenceProfilingAnalyzer:
    """Analyzes profiling data to find problematic Document Intelligence endpoints."""

    def __init__(self):
        # Try to get from settings first, fallback to environment
        try:
            from config import get_settings
            settings = get_settings()
            self.slow_threshold = float(settings.DOC_INTEL_PROFILING_SLOW_THRESHOLD_MS)
            self.memory_threshold = float(settings.DOC_INTEL_PROFILING_MEMORY_THRESHOLD_MB)
            self.p95_threshold = float(settings.DOC_INTEL_PROFILING_P95_THRESHOLD_MS)
        except Exception:
            # Fallback to environment variables
            self.slow_threshold = float(os.getenv('DOC_INTEL_PROFILING_SLOW_THRESHOLD_MS', '1000'))
            self.memory_threshold = float(os.getenv('DOC_INTEL_PROFILING_MEMORY_THRESHOLD_MB', '50'))
            self.p95_threshold = float(os.getenv('DOC_INTEL_PROFILING_P95_THRESHOLD_MS', '2000'))

    def analyze_week(self, year: int, week_number: int) -> List[ProblematicEndpoint]:
        """Analyze Document Intelligence endpoints for the given week."""
        from .db_storage import get_db_storage

        storage = get_db_storage()
        records = storage.get_records(year, week_number)

        if not records:
            logger.info(f"No profiling records found for week {week_number}/{year}")
            return []

        # Group records by endpoint, method, and document_type
        grouped = defaultdict(list)
        for record in records:
            key = (
                record.get('endpoint', ''),
                record.get('method', ''),
                record.get('document_type', 'N/A')
            )
            grouped[key].append(record)

        problematic = []

        for (endpoint, method, doc_type), group in grouped.items():
            # Calculate aggregates
            total_requests = len(group)
            times = [r['response_time_ms'] for r in group]
            memories = [r['memory_delta_mb'] for r in group]
            doc_sizes = [r.get('document_size_kb', 0) or 0 for r in group]
            pages = [r.get('pages_processed', 0) or 0 for r in group]

            avg_time_ms = sum(times) / len(times)
            avg_memory_mb = sum(memories) / len(memories)
            peak_memory_mb = max(memories)
            p95 = self._calculate_p95(times)

            avg_doc_size = sum(doc_sizes) / len(doc_sizes) if doc_sizes else 0
            avg_pages = sum(pages) / len(pages) if pages else 0

            # Get most common top function
            func_counts = defaultdict(int)
            for r in group:
                func = r.get('top_function', 'N/A')
                if func:
                    func_counts[func] += 1
            top_function = max(func_counts.items(), key=lambda x: x[1])[0] if func_counts else 'N/A'

            # Check thresholds and add problems
            endpoint_data = {
                'endpoint': endpoint,
                'method': method,
                'total_requests': total_requests,
                'avg_time_ms': avg_time_ms,
                'avg_memory_mb': avg_memory_mb,
                'peak_memory_mb': peak_memory_mb,
                'document_type': doc_type,
                'avg_document_size_kb': avg_doc_size,
                'avg_pages_processed': avg_pages
            }

            issues = self._check_thresholds(endpoint_data, p95)
            for issue_type, metric_value, threshold in issues:
                severity = self._calculate_severity(metric_value, threshold)
                problematic.append(ProblematicEndpoint(
                    severity=severity,
                    app_name='document_intelligence',
                    endpoint=endpoint,
                    method=method,
                    issue_type=issue_type,
                    metric_value=round(metric_value, 2),
                    threshold=threshold,
                    total_requests=total_requests,
                    avg_time_ms=round(avg_time_ms, 2),
                    p95_time_ms=round(p95, 2),
                    peak_memory_mb=round(peak_memory_mb, 3),
                    top_slow_function=top_function,
                    document_type=doc_type,
                    avg_document_size_kb=round(avg_doc_size, 2),
                    avg_pages_processed=round(avg_pages, 2)
                ))

        # Sort by severity
        severity_order = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2}
        problematic.sort(key=lambda x: (severity_order.get(x.severity, 3), -x.metric_value))

        return problematic

    def _check_thresholds(self, ep: Dict[str, Any], p95: float) -> List[Tuple[str, float, float]]:
        """Check which thresholds are exceeded."""
        issues = []

        avg_time = ep['avg_time_ms']
        avg_memory = ep['avg_memory_mb']

        if avg_time > self.slow_threshold:
            issues.append(('SLOW_RESPONSE', avg_time, self.slow_threshold))

        if avg_memory > self.memory_threshold:
            issues.append(('HIGH_MEMORY', avg_memory, self.memory_threshold))

        if p95 > self.p95_threshold:
            issues.append(('P95_EXCEEDED', p95, self.p95_threshold))

        return issues

    def _calculate_severity(self, value: float, threshold: float) -> str:
        """Calculate severity based on how much threshold is exceeded."""
        if threshold == 0:
            return 'MEDIUM'

        ratio = value / threshold
        if ratio >= 2.0:
            return 'CRITICAL'
        elif ratio >= 1.5:
            return 'HIGH'
        else:
            return 'MEDIUM'

    def _calculate_p95(self, times: list) -> float:
        """Calculate 95th percentile."""
        if not times:
            return 0.0
        sorted_times = sorted(times)
        index = int(len(sorted_times) * 0.95)
        return sorted_times[min(index, len(sorted_times) - 1)]
