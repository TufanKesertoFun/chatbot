"""
Database models for Document Intelligence profiling.
Uses SQLAlchemy for database operations.
"""
from sqlalchemy import Column, Integer, Float, String, DateTime, Boolean, Text, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from datetime import datetime

Base = declarative_base()


class DocumentIntelligenceProfilingRecord(Base):
    """Stores individual profiling records for each Document Intelligence request."""

    __tablename__ = 'DocumentIntelligenceProfilingRecord'

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Request Info
    app_name = Column(String(50), nullable=False, index=True, default='document_intelligence')
    endpoint = Column(String(255), nullable=False, index=True)
    method = Column(String(10), nullable=False)  # GET, POST, PUT, DELETE, etc.

    # Timing Metrics
    response_time_ms = Column(Float, nullable=False)
    function_calls = Column(Integer, default=0)

    # Memory Metrics
    memory_start_mb = Column(Float, default=0)
    memory_end_mb = Column(Float, default=0)
    memory_delta_mb = Column(Float, default=0)

    # Top Function Info
    top_function = Column(String(255))
    top_function_time_ms = Column(Float, default=0)

    # Metadata
    created_at = Column(DateTime, nullable=False, default=func.now(), index=True)
    week_number = Column(Integer, nullable=False, index=True)  # ISO week number
    year = Column(Integer, nullable=False, index=True)

    # Optional: user info
    user_id = Column(Integer, nullable=True)

    # Document Intelligence Specific Fields
    document_type = Column(String(100))
    document_size_kb = Column(Float, nullable=True)
    pages_processed = Column(Integer, nullable=True)

    # Indexes for common queries and schema specification
    __table_args__ = (
        Index('idx_app_endpoint_created', 'app_name', 'endpoint', 'created_at'),
        Index('idx_year_week_app', 'year', 'week_number', 'app_name'),
        Index('idx_document_type_created', 'document_type', 'created_at'),
        {'schema': 'profiling'}
    )

    def __repr__(self):
        return f"<ProfilingRecord(endpoint='{self.endpoint}', time={self.response_time_ms}ms)>"

    def to_dict(self):
        """Convert to dictionary format (similar to JSON storage)."""
        return {
            'id': self.id,
            'app_name': self.app_name,
            'endpoint': self.endpoint,
            'method': self.method,
            'response_time_ms': self.response_time_ms,
            'function_calls': self.function_calls,
            'memory_start_mb': self.memory_start_mb,
            'memory_end_mb': self.memory_end_mb,
            'memory_delta_mb': self.memory_delta_mb,
            'top_function': self.top_function,
            'top_function_time_ms': self.top_function_time_ms,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'week_number': self.week_number,
            'year': self.year,
            'user_id': self.user_id,
            'document_type': self.document_type,
            'document_size_kb': self.document_size_kb,
            'pages_processed': self.pages_processed
        }


class DocumentIntelligenceProfilingReportLog(Base):
    """Tracks generated profiling reports."""

    __tablename__ = 'DocumentIntelligenceProfilingReportLog'

    id = Column(Integer, primary_key=True, autoincrement=True)
    app_name = Column(String(50), nullable=False, default='document_intelligence')
    year = Column(Integer, nullable=False)
    week_number = Column(Integer, nullable=False)
    blob_url = Column(String(500))  # Can store email recipients or blob URL
    records_count = Column(Integer, nullable=False)
    generated_at = Column(DateTime, nullable=False, default=func.now())

    __table_args__ = (
        Index('idx_app_year_week', 'app_name', 'year', 'week_number', unique=True),
        {'schema': 'profiling'}
    )

    def __repr__(self):
        return f"<ReportLog(app='{self.app_name}', week={self.week_number}/{self.year})>"
