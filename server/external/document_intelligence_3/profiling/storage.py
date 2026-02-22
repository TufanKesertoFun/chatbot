"""
Storage backend for profiling data using JSON files.
"""
import json
import os
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from pathlib import Path
import threading

logger = logging.getLogger(__name__)


class ProfilingStorage:
    """Thread-safe JSON storage for profiling records."""

    def __init__(self, storage_dir: str = "profiling_data"):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    def _get_week_file(self, year: int, week_number: int) -> Path:
        """Get the file path for a specific week."""
        return self.storage_dir / f"week_{year}_W{week_number:02d}.json"

    def store_record(self, record: Dict[str, Any]) -> bool:
        """Store a single profiling record."""
        try:
            now = datetime.now()
            year = now.year
            week_number = now.isocalendar()[1]

            # Add timestamp and week info
            record['created_at'] = now.isoformat()
            record['year'] = year
            record['week_number'] = week_number

            file_path = self._get_week_file(year, week_number)

            with self._lock:
                # Load existing records
                records = []
                if file_path.exists():
                    with open(file_path, 'r') as f:
                        records = json.load(f)

                # Append new record
                records.append(record)

                # Write back
                with open(file_path, 'w') as f:
                    json.dump(records, f, indent=2)

            return True

        except Exception as e:
            logger.error(f"Failed to store profiling record: {e}")
            return False

    def get_records(
        self,
        year: int,
        week_number: int,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Retrieve records for a specific week with optional filters."""
        try:
            file_path = self._get_week_file(year, week_number)

            if not file_path.exists():
                return []

            with self._lock:
                with open(file_path, 'r') as f:
                    records = json.load(f)

            # Apply filters
            if filters:
                filtered = []
                for record in records:
                    match = True
                    for key, value in filters.items():
                        if record.get(key) != value:
                            match = False
                            break
                    if match:
                        filtered.append(record)
                return filtered

            return records

        except Exception as e:
            logger.error(f"Failed to retrieve profiling records: {e}")
            return []

    def get_all_weeks(self) -> List[tuple]:
        """Get list of all available (year, week_number) tuples."""
        weeks = []
        for file_path in self.storage_dir.glob("week_*.json"):
            try:
                # Parse filename: week_2024_W52.json
                parts = file_path.stem.split('_')
                year = int(parts[1])
                week_number = int(parts[2][1:])  # Remove 'W' prefix
                weeks.append((year, week_number))
            except (ValueError, IndexError):
                continue
        return sorted(weeks)

    def cleanup_old_records(self, days_to_keep: int = 90) -> int:
        """Remove records older than specified days."""
        from datetime import timedelta

        cutoff = datetime.now() - timedelta(days=days_to_keep)
        cutoff_week = cutoff.isocalendar()[1]
        cutoff_year = cutoff.year

        deleted_count = 0
        with self._lock:
            for file_path in self.storage_dir.glob("week_*.json"):
                try:
                    parts = file_path.stem.split('_')
                    year = int(parts[1])
                    week_number = int(parts[2][1:])

                    # Simple comparison: if year is older or same year but older week
                    if year < cutoff_year or (year == cutoff_year and week_number < cutoff_week):
                        file_path.unlink()
                        deleted_count += 1
                except (ValueError, IndexError, OSError) as e:
                    logger.error(f"Error deleting old profiling file {file_path}: {e}")

        return deleted_count

    def store_report_log(self, log: Dict[str, Any]) -> bool:
        """Store a report generation log."""
        try:
            log_file = self.storage_dir / "report_logs.json"

            with self._lock:
                logs = []
                if log_file.exists():
                    with open(log_file, 'r') as f:
                        logs = json.load(f)

                log['generated_at'] = datetime.now().isoformat()
                logs.append(log)

                with open(log_file, 'w') as f:
                    json.dump(logs, f, indent=2)

            return True

        except Exception as e:
            logger.error(f"Failed to store report log: {e}")
            return False


# Global storage instance
_storage = None


def get_storage(storage_dir: Optional[str] = None) -> ProfilingStorage:
    """Get or create the global storage instance."""
    global _storage
    if _storage is None:
        if storage_dir is None:
            # Try to get from settings first, fallback to environment
            try:
                from config import get_settings
                settings = get_settings()
                storage_dir = settings.PROFILING_STORAGE_DIR
            except Exception:
                # Fallback to environment variable
                storage_dir = os.getenv('PROFILING_STORAGE_DIR', 'profiling_data/document_intelligence')
        _storage = ProfilingStorage(storage_dir)
    return _storage
