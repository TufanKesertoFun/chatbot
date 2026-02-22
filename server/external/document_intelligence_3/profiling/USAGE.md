# Document Intelligence Profiling - Usage Guide

## ✅ What Was Added

### Profiling Decorators (All Public Methods)
- `@profile_endpoint` decorator added to **all public methods**:
  - `analyze_and_split_document_from_blob()` - Main entry point
  - `analyze_document_from_file()` - Direct file analysis
  - `extract_word_document_metadata()` - Word metadata extraction
  - `process_spreadsheet_file()` - Spreadsheet processing

### Profiling Context Managers (Internal Processing)
- `Profiler` context manager added to **internal processing methods**:
  - `_process_word_document()` - Word document processing with page count
  - `_process_spreadsheet_file()` - CSV/Excel processing
  - `_process_with_document_intelligence()` - General document processing

## Why Both Decorator AND Context Manager?

**Decorator (`@profile_endpoint`)**:
- Lightweight, profiles the entire method call
- Good for tracking API-level performance
- Applied to **public methods** (the ones users call)

**Context Manager (`with Profiler()`)**:
- More detailed, can track document-specific metrics
- Can update metrics during processing (e.g., page count after analyzing)
- Applied to **internal methods** (where actual work happens)
- Provides document size, type, and pages processed

## Configuration

### Enable Profiling
```powershell
# Windows PowerShell
$env:PROFILING_ENABLED="true"
$env:PROFILING_MEMORY_ENABLED="true"
$env:PROFILING_MIN_TIME_MS="100"
$env:PROFILING_STORAGE_DIR="profiling_data/document_intelligence"

# Thresholds for issue detection
$env:DOC_INTEL_PROFILING_SLOW_THRESHOLD_MS="1000"
$env:DOC_INTEL_PROFILING_MEMORY_THRESHOLD_MB="50"
$env:DOC_INTEL_PROFILING_P95_THRESHOLD_MS="2000"
```

### Email Configuration (Optional)
```powershell
$env:DOC_INTEL_PROFILING_REPORT_RECIPIENTS="dev@example.com,ops@example.com"
$env:SMTP_HOST="smtp.gmail.com"
$env:SMTP_PORT="587"
$env:SMTP_USER="your-email@gmail.com"
$env:SMTP_PASSWORD="your-app-password"
$env:SMTP_FROM_EMAIL="noreply@example.com"
```

## How It Works

### 1. Automatic Profiling
When enabled, profiling happens automatically on every document processing call:

```python
# Your existing code - no changes needed!
doc_intel = DocumentIntelligence(settings)
documents = await doc_intel.analyze_and_split_document_from_blob(
    container_name="my-container",
    blob_path="documents/invoice.pdf",
    bot_id="bot-123"
)
# Profiling data is automatically stored
```

### 2. Data Storage
Profiling data is stored in JSON files by week:
```
profiling_data/document_intelligence/
├── week_2026_W04.json          # Current week
├── week_2026_W03.json          # Previous weeks
└── report_logs.json            # Email report history
```

### 3. View Profiling Data
```python
from Managers.Document_Intelligence_3.profiling.storage import get_storage
from datetime import datetime

storage = get_storage()
now = datetime.now()
records = storage.get_records(now.year, now.isocalendar()[1])

print(f"Total records this week: {len(records)}\n")

for record in records[:10]:  # Show first 10
    print(f"Endpoint: {record['endpoint']}")
    print(f"  Time: {record['response_time_ms']:.2f}ms")
    print(f"  Memory: {record['memory_delta_mb']:.2f}MB")
    print(f"  Type: {record.get('document_type', 'N/A')}")
    print(f"  Size: {record.get('document_size_kb', 0):.2f}KB")
    print(f"  Pages: {record.get('pages_processed', 'N/A')}")
    print(f"  Created: {record['created_at']}")
    print()
```

### 4. Generate Weekly Report
```bash
# Run manually
python -m Managers.Document_Intelligence_3.profiling.tasks report

# Or schedule with cron (Linux/Mac)
0 9 * * 1 cd /path/to/project && python -m Managers.Document_Intelligence_3.profiling.tasks report

# Or schedule with Task Scheduler (Windows)
```

## What Gets Tracked

### For All Documents:
- Response time (ms)
- Memory usage (MB)
- Function call count
- Slowest function

### Document-Specific:
- Document type (pdf, docx, csv, xlsx, etc.)
- Document size (KB)
- Pages processed
- Top slow function
- Created timestamp
- Week/year for grouping

## Viewing Results

### Option 1: Direct JSON
```powershell
# View raw JSON
cat profiling_data/document_intelligence/week_2026_W04.json
```

### Option 2: Python Script
Create `view_profiles.py`:
```python
from Managers.Document_Intelligence_3.profiling.storage import get_storage
from datetime import datetime
import json

storage = get_storage()
now = datetime.now()
records = storage.get_records(now.year, now.isocalendar()[1])

# Group by document type
by_type = {}
for record in records:
    doc_type = record.get('document_type', 'unknown')
    if doc_type not in by_type:
        by_type[doc_type] = []
    by_type[doc_type].append(record)

# Print summary
for doc_type, type_records in by_type.items():
    print(f"\n{doc_type.upper()} Files ({len(type_records)} processed):")
    avg_time = sum(r['response_time_ms'] for r in type_records) / len(type_records)
    avg_memory = sum(r['memory_delta_mb'] for r in type_records) / len(type_records)
    print(f"  Avg Time: {avg_time:.2f}ms")
    print(f"  Avg Memory: {avg_memory:.2f}MB")
```

### Option 3: Weekly Email Report
Reports include:
- CRITICAL/HIGH/MEDIUM severity issues
- Slow response times (>1000ms default)
- High memory usage (>50MB default)
- P95 threshold violations (>2000ms default)
- CSV attachment with full details

## Cleanup Old Data
```bash
# Keep last 90 days, delete older
python -m Managers.Document_Intelligence_3.profiling.tasks cleanup 90
```

## Troubleshooting

### No data being stored?
1. Check `PROFILING_ENABLED=true`
2. Check minimum time threshold: `PROFILING_MIN_TIME_MS=100`
3. Ensure psutil is installed: `pip install psutil`

### Want more detailed profiling?
Lower the minimum time threshold:
```powershell
$env:PROFILING_MIN_TIME_MS="0"  # Profile everything
```

### Disable profiling temporarily?
```powershell
$env:PROFILING_ENABLED="false"
```

## Performance Impact

- **Decorator overhead**: ~1-2ms per call
- **Context manager overhead**: ~2-5ms per call
- **Memory tracking overhead**: ~5-10ms per call
- **Storage overhead**: ~1ms per record

**Total overhead**: ~5-20ms per document processed (negligible for document processing which takes seconds)

## Benefits

1. **Identify slow documents**: See which document types/sizes are slowest
2. **Memory leaks**: Track memory usage over time
3. **Performance regression**: Compare week-to-week performance
4. **Capacity planning**: Understand resource requirements
5. **Optimization targets**: Find bottlenecks in processing pipeline
