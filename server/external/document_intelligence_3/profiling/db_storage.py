"""
Database storage backend for profiling data using SQLAlchemy.
Replaces JSON file storage with PostgreSQL database storage.
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy import create_engine, and_, or_, desc
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import SQLAlchemyError
from .db_models import Base, DocumentIntelligenceProfilingRecord, DocumentIntelligenceProfilingReportLog

logger = logging.getLogger(__name__)


class DatabaseProfilingStorage:
    """Database storage for profiling records using SQLAlchemy."""

    def __init__(self, connection_string: str):
        """
        Initialize database storage.

        Args:
            connection_string: PostgreSQL connection string
                Example: "postgresql://user:password@localhost:5432/dbname"
        """
        self.engine = create_engine(
            connection_string,
            pool_pre_ping=True,  # Verify connections before using
            pool_size=5,
            max_overflow=10
        )
        self.SessionLocal = sessionmaker(bind=self.engine)

        # Create tables if they don't exist
        self._init_database()

    def _init_database(self):
        """Create tables if they don't exist."""
        try:
            Base.metadata.create_all(self.engine)
            logger.info("Database tables initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize database tables: {e}")
            raise

    def _get_session(self) -> Session:
        """Get a new database session."""
        return self.SessionLocal()

    def store_record(self, record: Dict[str, Any]) -> bool:
        """Store a single profiling record."""
        session = self._get_session()
        try:
            # Calculate week info if not provided
            now = datetime.now()
            if 'year' not in record:
                record['year'] = now.year
            if 'week_number' not in record:
                record['week_number'] = now.isocalendar()[1]
            if 'created_at' not in record:
                record['created_at'] = now

            # Create record
            db_record = DocumentIntelligenceProfilingRecord(
                app_name=record.get('app_name', 'document_intelligence'),
                endpoint=record['endpoint'],
                method=record['method'],
                response_time_ms=record['response_time_ms'],
                function_calls=record.get('function_calls', 0),
                memory_start_mb=record.get('memory_start_mb', 0),
                memory_end_mb=record.get('memory_end_mb', 0),
                memory_delta_mb=record.get('memory_delta_mb', 0),
                top_function=record.get('top_function', ''),
                top_function_time_ms=record.get('top_function_time_ms', 0),
                year=record['year'],
                week_number=record['week_number'],
                user_id=record.get('user_id'),
                document_type=record.get('document_type'),
                document_size_kb=record.get('document_size_kb'),
                pages_processed=record.get('pages_processed'),
                created_at=record['created_at']
            )

            session.add(db_record)
            session.commit()
            logger.debug(f"Stored profiling record: {record['endpoint']}")
            return True

        except SQLAlchemyError as e:
            session.rollback()
            logger.error(f"Failed to store profiling record: {e}")
            return False
        finally:
            session.close()

    def get_records(
        self,
        year: int,
        week_number: int,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Retrieve records for a specific week with optional filters."""
        session = self._get_session()
        try:
            query = session.query(DocumentIntelligenceProfilingRecord).filter(
                and_(
                    DocumentIntelligenceProfilingRecord.year == year,
                    DocumentIntelligenceProfilingRecord.week_number == week_number
                )
            )

            # Apply additional filters
            if filters:
                for key, value in filters.items():
                    if hasattr(DocumentIntelligenceProfilingRecord, key):
                        query = query.filter(
                            getattr(DocumentIntelligenceProfilingRecord, key) == value
                        )

            # Order by created_at descending
            query = query.order_by(desc(DocumentIntelligenceProfilingRecord.created_at))

            # Convert to dict format
            records = [record.to_dict() for record in query.all()]
            logger.debug(f"Retrieved {len(records)} records for week {week_number}/{year}")
            return records

        except SQLAlchemyError as e:
            logger.error(f"Failed to retrieve profiling records: {e}")
            return []
        finally:
            session.close()

    def get_all_weeks(self) -> List[tuple]:
        """Get list of all available (year, week_number) tuples."""
        session = self._get_session()
        try:
            results = session.query(
                DocumentIntelligenceProfilingRecord.year,
                DocumentIntelligenceProfilingRecord.week_number
            ).distinct().order_by(
                DocumentIntelligenceProfilingRecord.year,
                DocumentIntelligenceProfilingRecord.week_number
            ).all()

            weeks = [(year, week) for year, week in results]
            logger.debug(f"Found {len(weeks)} weeks with profiling data")
            return weeks

        except SQLAlchemyError as e:
            logger.error(f"Failed to retrieve weeks: {e}")
            return []
        finally:
            session.close()

    def cleanup_old_records(self, days_to_keep: int = 90) -> int:
        """Remove records older than specified days."""
        session = self._get_session()
        try:
            cutoff_date = datetime.now() - timedelta(days=days_to_keep)

            deleted_count = session.query(DocumentIntelligenceProfilingRecord).filter(
                DocumentIntelligenceProfilingRecord.created_at < cutoff_date
            ).delete()

            session.commit()
            logger.info(f"Deleted {deleted_count} old profiling records (older than {days_to_keep} days)")
            return deleted_count

        except SQLAlchemyError as e:
            session.rollback()
            logger.error(f"Failed to cleanup old records: {e}")
            return 0
        finally:
            session.close()

    def store_report_log(self, log: Dict[str, Any]) -> bool:
        """Store a report generation log."""
        session = self._get_session()
        try:
            db_log = DocumentIntelligenceProfilingReportLog(
                app_name=log.get('app_name', 'document_intelligence'),
                year=log['year'],
                week_number=log['week_number'],
                blob_url=log.get('blob_url', ''),
                records_count=log['records_count']
            )

            # Try to update if exists, otherwise insert
            existing = session.query(DocumentIntelligenceProfilingReportLog).filter(
                and_(
                    DocumentIntelligenceProfilingReportLog.app_name == db_log.app_name,
                    DocumentIntelligenceProfilingReportLog.year == db_log.year,
                    DocumentIntelligenceProfilingReportLog.week_number == db_log.week_number
                )
            ).first()

            if existing:
                existing.blob_url = db_log.blob_url
                existing.records_count = db_log.records_count
                existing.generated_at = datetime.now()
            else:
                session.add(db_log)

            session.commit()
            logger.debug(f"Stored report log for week {log['week_number']}/{log['year']}")
            return True

        except SQLAlchemyError as e:
            session.rollback()
            logger.error(f"Failed to store report log: {e}")
            return False
        finally:
            session.close()

    def get_aggregated_stats(
        self,
        year: int,
        week_number: int,
        group_by: str = 'endpoint'
    ) -> List[Dict[str, Any]]:
        """
        Get aggregated statistics for a week.

        Args:
            year: Year
            week_number: ISO week number
            group_by: Field to group by ('endpoint', 'document_type', etc.)
        """
        session = self._get_session()
        try:
            from sqlalchemy import func as sql_func

            # Build aggregation query
            query = session.query(
                getattr(DocumentIntelligenceProfilingRecord, group_by),
                sql_func.count(DocumentIntelligenceProfilingRecord.id).label('count'),
                sql_func.avg(DocumentIntelligenceProfilingRecord.response_time_ms).label('avg_time_ms'),
                sql_func.max(DocumentIntelligenceProfilingRecord.response_time_ms).label('max_time_ms'),
                sql_func.min(DocumentIntelligenceProfilingRecord.response_time_ms).label('min_time_ms'),
                sql_func.avg(DocumentIntelligenceProfilingRecord.memory_delta_mb).label('avg_memory_mb'),
                sql_func.max(DocumentIntelligenceProfilingRecord.memory_delta_mb).label('max_memory_mb')
            ).filter(
                and_(
                    DocumentIntelligenceProfilingRecord.year == year,
                    DocumentIntelligenceProfilingRecord.week_number == week_number
                )
            ).group_by(
                getattr(DocumentIntelligenceProfilingRecord, group_by)
            )

            results = []
            for row in query.all():
                results.append({
                    group_by: row[0],
                    'count': row[1],
                    'avg_time_ms': float(row[2]) if row[2] else 0,
                    'max_time_ms': float(row[3]) if row[3] else 0,
                    'min_time_ms': float(row[4]) if row[4] else 0,
                    'avg_memory_mb': float(row[5]) if row[5] else 0,
                    'max_memory_mb': float(row[6]) if row[6] else 0
                })

            return results

        except SQLAlchemyError as e:
            logger.error(f"Failed to get aggregated stats: {e}")
            return []
        finally:
            session.close()


# Global storage instance
_db_storage = None


def get_db_storage(connection_string: Optional[str] = None) -> DatabaseProfilingStorage:
    """Get or create the global database storage instance."""
    global _db_storage

    if _db_storage is None:
        if connection_string is None:
            # Try to get from settings or build from environment
            try:
                from config import get_settings
                from urllib.parse import quote_plus
                settings = get_settings()
                # For Azure PostgreSQL, username might already include @hostname
                # Extract just the username part if it contains @
                username = settings.DATABASE_USERNAME
                if '@' in username:
                    username = username.split('@')[0]

                # URL encode username and password to handle special characters like @ in password
                encoded_username = quote_plus(username)
                encoded_password = quote_plus(settings.DATABASE_PASSWORD)

                connection_string = (
                    f"postgresql://{encoded_username}:{encoded_password}"
                    f"@{settings.DATABASE_HOST}:{settings.DATABASE_PORT}/{settings.DATABASE_NAME}"
                )
            except Exception as e:
                logger.error(f"Failed to get database connection from settings: {e}")
                raise ValueError("Database connection string not available")

        _db_storage = DatabaseProfilingStorage(connection_string)

    return _db_storage
