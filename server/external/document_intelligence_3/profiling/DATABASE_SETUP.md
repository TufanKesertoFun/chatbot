# Database Storage for Document Intelligence Profiling

## Overview

Profiling data is now stored in your **PostgreSQL database** instead of JSON files!

### Database Tables

**1. `doc_intel_profiling_records`** - Stores individual profiling records
- Request info (endpoint, method, app_name)
- Timing metrics (response_time_ms, function_calls)
- Memory metrics (memory_start_mb, memory_end_mb, memory_delta_mb)
- Document metrics (document_type, document_size_kb, pages_processed)
- Metadata (created_at, year, week_number)

**2. `doc_intel_profiling_report_logs`** - Tracks generated reports
- Report metadata (year, week_number, records_count)
- Email recipients or blob URL
- Generated timestamp

## Setup

### Step 1: Install Required Package

```bash
pip install sqlalchemy psycopg2-binary
```

### Step 2: Initialize Database Tables

```bash
# Navigate to profiling directory
cd Managers/Document_Intelligence_3/profiling

# Create tables (uses your existing database connection from config.py)
python init_database.py init

# Check table status
python init_database.py status
```

### Step 3: Enable Profiling

Add to your `.env` file:
```bash
# Document Intelligence Profiling
PROFILING_ENABLED=true
PROFILING_MEMORY_ENABLED=true
PROFILING_MIN_TIME_MS=100

# Thresholds
DOC_INTEL_PROFILING_SLOW_THRESHOLD_MS=1000
DOC_INTEL_PROFILING_MEMORY_THRESHOLD_MB=50
DOC_INTEL_PROFILING_P95_THRESHOLD_MS=2000

# Email Reports (Optional)
DOC_INTEL_PROFILING_REPORT_RECIPIENTS=dev@example.com
```

### Step 4: Process Documents

Your existing code works automatically - profiling happens in the background!

```python
# Your existing code - no changes needed
doc_intel = DocumentIntelligence(settings)
documents = await doc_intel.analyze_and_split_document_from_blob(
    container_name="my-container",
    blob_path="documents/invoice.pdf",
    bot_id="bot-123"
)
# Profiling data is automatically stored in the database!
```

## View Results

### Option 1: Direct SQL Query

```sql
-- View recent profiling records
SELECT
    endpoint,
    method,
    response_time_ms,
    memory_delta_mb,
    document_type,
    document_size_kb,
    pages_processed,
    created_at
FROM doc_intel_profiling_records
ORDER BY created_at DESC
LIMIT 10;

-- Get statistics by document type
SELECT
    document_type,
    COUNT(*) as count,
    AVG(response_time_ms) as avg_time_ms,
    AVG(memory_delta_mb) as avg_memory_mb,
    AVG(document_size_kb) as avg_size_kb
FROM doc_intel_profiling_records
WHERE year = 2026 AND week_number = 4
GROUP BY document_type;

-- Find slow endpoints
SELECT
    endpoint,
    method,
    COUNT(*) as requests,
    AVG(response_time_ms) as avg_time,
    MAX(response_time_ms) as max_time
FROM doc_intel_profiling_records
WHERE response_time_ms > 1000
GROUP BY endpoint, method
ORDER BY avg_time DESC;
```

### Option 2: Python Script

Create `view_db_profiling.py`:

```python
from Managers.Document_Intelligence_3.profiling.db_storage import get_db_storage
from datetime import datetime

# Get database storage
storage = get_db_storage()

# Get current week's data
now = datetime.now()
year = now.year
week = now.isocalendar()[1]

print(f"=== Profiling Data for Week {week}/{year} ===\n")

# Get records
records = storage.get_records(year, week)
print(f"Total records: {len(records)}\n")

# Show first 10 records
for i, record in enumerate(records[:10], 1):
    print(f"Record #{i}")
    print(f"  Endpoint: {record['endpoint']}")
    print(f"  Method: {record['method']}")
    print(f"  Time: {record['response_time_ms']:.2f}ms")
    print(f"  Memory: {record['memory_delta_mb']:.2f}MB")
    print(f"  Document Type: {record.get('document_type', 'N/A')}")
    print(f"  Document Size: {record.get('document_size_kb', 0):.2f}KB")
    print(f"  Pages: {record.get('pages_processed', 'N/A')}")
    print(f"  Created: {record['created_at']}")
    print()

# Get aggregated statistics
print("\n=== Statistics by Document Type ===")
stats = storage.get_aggregated_stats(year, week, group_by='document_type')
for stat in stats:
    print(f"\n{stat['document_type']}:")
    print(f"  Count: {stat['count']}")
    print(f"  Avg Time: {stat['avg_time_ms']:.2f}ms")
    print(f"  Max Time: {stat['max_time_ms']:.2f}ms")
    print(f"  Avg Memory: {stat['avg_memory_mb']:.2f}MB")
```

Run it:
```bash
python view_db_profiling.py
```

### Option 3: Use Analyzer

```python
from Managers.Document_Intelligence_3.profiling.analyzer import DocumentIntelligenceProfilingAnalyzer
from datetime import datetime

analyzer = DocumentIntelligenceProfilingAnalyzer()
now = datetime.now()

# Find problematic endpoints
problems = analyzer.analyze_week(now.year, now.isocalendar()[1])

print(f"Found {len(problems)} performance issues:\n")

for problem in problems:
    print(f"[{problem.severity}] {problem.endpoint}")
    print(f"  Issue: {problem.issue_type}")
    print(f"  Value: {problem.metric_value} (threshold: {problem.threshold})")
    print(f"  Requests: {problem.total_requests}")
    print(f"  Document Type: {problem.document_type}")
    print()
```

## Database Schema

### doc_intel_profiling_records

| Column | Type | Description |
|--------|------|-------------|
| id | Integer | Primary key |
| app_name | String(50) | Application name |
| endpoint | String(255) | API endpoint |
| method | String(10) | HTTP method |
| response_time_ms | Float | Response time in milliseconds |
| function_calls | Integer | Number of function calls |
| memory_start_mb | Float | Memory at start (MB) |
| memory_end_mb | Float | Memory at end (MB) |
| memory_delta_mb | Float | Memory change (MB) |
| top_function | String(255) | Slowest function |
| top_function_time_ms | Float | Top function time (ms) |
| created_at | DateTime | Creation timestamp |
| week_number | Integer | ISO week number |
| year | Integer | Year |
| user_id | Integer | User ID (nullable) |
| document_type | String(100) | Document type (pdf, docx, etc.) |
| document_size_kb | Float | Document size in KB |
| pages_processed | Integer | Number of pages processed |

### Indexes

- `idx_app_endpoint_created` - (app_name, endpoint, created_at)
- `idx_year_week_app` - (year, week_number, app_name)
- `idx_document_type_created` - (document_type, created_at)

## Management Commands

```bash
# Check database status
python init_database.py status

# Re-create tables (WARNING: deletes data!)
python init_database.py drop
python init_database.py init

# Clean up old records (older than 90 days)
python -m Managers.Document_Intelligence_3.profiling.tasks cleanup 90
```

## Generate Weekly Report

```bash
# Generate and email report for last week
python -m Managers.Document_Intelligence_3.profiling.tasks report
```

## Benefits of Database Storage

### vs JSON Files

✅ **Better Performance**
- Indexed queries are fast
- Aggregations built into database
- No need to load entire week into memory

✅ **Better Querying**
- SQL for complex queries
- Join with other tables
- Real-time analytics

✅ **Better Scalability**
- Handles millions of records
- Automatic cleanup
- Connection pooling

✅ **Better Integration**
- Uses existing database
- Part of your backup strategy
- Query from BI tools

## Troubleshooting

### Tables not created?

Check your database connection in `.env`:
```bash
DATABASE_NAME=your_db
DATABASE_USERNAME=your_user
DATABASE_PASSWORD=your_password
DATABASE_HOST=localhost
DATABASE_PORT=5432
```

### No data being stored?

1. Check profiling is enabled:
   ```python
   from config import get_settings
   print(get_settings().PROFILING_ENABLED)  # Should be True
   ```

2. Check database connection:
   ```bash
   python init_database.py status
   ```

3. Check logs for errors:
   ```python
   import logging
   logging.basicConfig(level=logging.DEBUG)
   ```

### Slow queries?

The tables have indexes on common query patterns. For custom queries, add indexes:

```sql
CREATE INDEX idx_custom ON doc_intel_profiling_records(your_column);
```

## Migration from JSON Files

If you were using JSON file storage previously:

```python
import json
from Managers.Document_Intelligence_3.profiling.db_storage import get_db_storage
from pathlib import Path

storage = get_db_storage()

# Read old JSON files
for json_file in Path('profiling_data/document_intelligence').glob('week_*.json'):
    with open(json_file) as f:
        records = json.load(f)

    # Store in database
    for record in records:
        storage.store_record(record)

    print(f"Migrated {len(records)} records from {json_file.name}")
```

## Security

- Uses SQLAlchemy ORM (prevents SQL injection)
- Connection pooling enabled
- Passwords never logged
- Uses existing database credentials from config

## Performance Tips

1. **Adjust minimum time threshold** to reduce noise:
   ```bash
   PROFILING_MIN_TIME_MS=500  # Only store requests >500ms
   ```

2. **Regular cleanup** prevents table bloat:
   ```bash
   # Run monthly via cron
   python -m Managers.Document_Intelligence_3.profiling.tasks cleanup 90
   ```

3. **Monitor table size**:
   ```sql
   SELECT pg_size_pretty(pg_total_relation_size('doc_intel_profiling_records'));
   ```
