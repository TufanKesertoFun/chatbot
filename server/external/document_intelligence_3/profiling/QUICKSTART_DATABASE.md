# Quick Start: Database Profiling for Document Intelligence

## ✅ What You Get

Profiling data stored in your **PostgreSQL database** with:
- ✅ Real-time performance tracking
- ✅ SQL queries for analysis
- ✅ Automatic weekly reports
- ✅ Integration with existing database
- ✅ No JSON files needed!

## 🚀 3-Step Setup

### 1. Install Package
```bash
pip install sqlalchemy psycopg2-binary
```

### 2. Create Database Tables
```bash
cd Managers/Document_Intelligence_3/profiling
python init_database.py init
```

Expected output:
```
Creating database engine...
✓ Table 'doc_intel_profiling_records' created successfully
✓ Table 'doc_intel_profiling_report_logs' created successfully
✓ Database initialization completed successfully!
```

### 3. Enable in `.env`
```bash
PROFILING_ENABLED=true
PROFILING_MEMORY_ENABLED=true
```

**That's it!** Profiling now automatically stores to your database.

## 📊 View Results

### Quick SQL Query
```sql
SELECT
    endpoint,
    response_time_ms,
    memory_delta_mb,
    document_type,
    created_at
FROM doc_intel_profiling_records
ORDER BY created_at DESC
LIMIT 10;
```

### Python Script
```python
from Managers.Document_Intelligence_3.profiling.db_storage import get_db_storage
from datetime import datetime

storage = get_db_storage()
now = datetime.now()
records = storage.get_records(now.year, now.isocalendar()[1])

for record in records[:10]:
    print(f"{record['endpoint']}: {record['response_time_ms']}ms - {record['document_type']}")
```

### Find Issues
```python
from Managers.Document_Intelligence_3.profiling.analyzer import DocumentIntelligenceProfilingAnalyzer
from datetime import datetime

analyzer = DocumentIntelligenceProfilingAnalyzer()
now = datetime.now()
problems = analyzer.analyze_week(now.year, now.isocalendar()[1])

for p in problems:
    print(f"[{p.severity}] {p.endpoint}: {p.issue_type}")
```

## 📈 Database Tables

### doc_intel_profiling_records
Stores each document processing operation:
- Response time, memory usage
- Document type, size, pages
- Function call stats
- Created timestamp, week/year

### doc_intel_profiling_report_logs
Tracks weekly email reports sent

## 🎯 No Code Changes Needed!

Your existing Document Intelligence code already has profiling - just enable it:

```python
# Your existing code works as-is
doc_intel = DocumentIntelligence(settings)
documents = await doc_intel.analyze_and_split_document_from_blob(
    container_name="my-container",
    blob_path="documents/invoice.pdf"
)
# Profiling happens automatically in background!
```

## 🔍 Useful Queries

### Slow Endpoints
```sql
SELECT endpoint, AVG(response_time_ms) as avg_time
FROM doc_intel_profiling_records
WHERE response_time_ms > 1000
GROUP BY endpoint
ORDER BY avg_time DESC;
```

### Memory Hogs
```sql
SELECT endpoint, document_type, AVG(memory_delta_mb) as avg_memory
FROM doc_intel_profiling_records
GROUP BY endpoint, document_type
ORDER BY avg_memory DESC
LIMIT 10;
```

### By Document Type
```sql
SELECT
    document_type,
    COUNT(*) as count,
    AVG(response_time_ms) as avg_time,
    AVG(document_size_kb) as avg_size,
    AVG(pages_processed) as avg_pages
FROM doc_intel_profiling_records
GROUP BY document_type;
```

## ⚙️ Management

### Check Status
```bash
python init_database.py status
```

### Clean Old Data (90+ days)
```bash
python -m Managers.Document_Intelligence_3.profiling.tasks cleanup 90
```

### Generate Weekly Report
```bash
python -m Managers.Document_Intelligence_3.profiling.tasks report
```

## 🔧 Configuration

All settings in your existing `.env` file:

```bash
# Enable/Disable
PROFILING_ENABLED=true
PROFILING_MEMORY_ENABLED=true
PROFILING_MIN_TIME_MS=100

# Alert Thresholds
DOC_INTEL_PROFILING_SLOW_THRESHOLD_MS=1000
DOC_INTEL_PROFILING_MEMORY_THRESHOLD_MB=50
DOC_INTEL_PROFILING_P95_THRESHOLD_MS=2000

# Email Reports
DOC_INTEL_PROFILING_REPORT_RECIPIENTS=dev@example.com,ops@example.com
```

## 📚 More Info

- Full setup guide: `DATABASE_SETUP.md`
- Settings integration: `SETTINGS_INTEGRATION.md`
- Usage examples: `USAGE.md`

## ❓ Troubleshooting

**No data appearing?**
1. Check: `python init_database.py status`
2. Verify: `PROFILING_ENABLED=true` in `.env`
3. Process a document and query the table

**Tables not created?**
- Check database connection in `.env`:
  ```bash
  DATABASE_NAME=your_db
  DATABASE_USERNAME=your_user
  DATABASE_PASSWORD=your_password
  DATABASE_HOST=localhost
  DATABASE_PORT=5432
  ```

**Need help?**
- Run: `python init_database.py status`
- Check logs for errors
- Verify database credentials

## 🎉 Benefits

**vs JSON Files:**
- ✅ Faster queries (indexed)
- ✅ Better for large datasets
- ✅ SQL analytics
- ✅ Integration with BI tools
- ✅ Automatic backups
- ✅ No file management

**vs No Profiling:**
- ✅ Find bottlenecks
- ✅ Track performance trends
- ✅ Identify memory leaks
- ✅ Optimize document processing
- ✅ Capacity planning data
