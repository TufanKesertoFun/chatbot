# Document Intelligence Profiling

Standalone profiling system for Document Intelligence module with no Django dependencies.

## Features

- CPU and memory profiling
- JSON-based storage
- Weekly email reports for problematic endpoints
- Document-specific metrics (type, size, pages)
- Configurable thresholds via environment variables

## Installation

```bash
pip install psutil
```

## Configuration

Set environment variables:

```bash
# Enable/disable profiling
export PROFILING_ENABLED=true
export PROFILING_MEMORY_ENABLED=true
export PROFILING_MIN_TIME_MS=100

# Storage location
export PROFILING_STORAGE_DIR=profiling_data/document_intelligence

# Thresholds
export DOC_INTEL_PROFILING_SLOW_THRESHOLD_MS=1000
export DOC_INTEL_PROFILING_MEMORY_THRESHOLD_MB=50
export DOC_INTEL_PROFILING_P95_THRESHOLD_MS=2000

# Email configuration
export DOC_INTEL_PROFILING_REPORT_RECIPIENTS=dev@example.com,ops@example.com
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USER=your-email@example.com
export SMTP_PASSWORD=your-password
export SMTP_FROM_EMAIL=noreply@example.com
```

## Usage

### Decorator

```python
from Managers.Document_Intelligence_3.profiling import profile_endpoint

@profile_endpoint(name='process_document', document_type='invoice')
def process_document(doc_path):
    # Your code here
    pass
```

### Context Manager

```python
from Managers.Document_Intelligence_3.profiling import Profiler

def analyze_document(doc_path, doc_size_kb, num_pages):
    with Profiler(
        name='analyze_document',
        document_type='contract',
        document_size_kb=doc_size_kb,
        pages_processed=num_pages
    ):
        # Your code here
        pass
```

### Manual Profiling

```python
from Managers.Document_Intelligence_3.profiling import profile_cpu, profile_memory

@profile_cpu()
@profile_memory()
def my_function():
    # Your code here
    pass
```

## Running Tasks

### Weekly Report (Manual)

```bash
python -m Managers.Document_Intelligence_3.profiling.tasks report
```

### Cleanup Old Records

```bash
python -m Managers.Document_Intelligence_3.profiling.tasks cleanup 90
```

### Schedule with Cron

```cron
# Run weekly report every Monday at 9 AM
0 9 * * 1 cd /path/to/project && python -m Managers.Document_Intelligence_3.profiling.tasks report

# Cleanup old records monthly
0 2 1 * * cd /path/to/project && python -m Managers.Document_Intelligence_3.profiling.tasks cleanup 90
```

## Data Storage

Profiling data is stored as JSON files:
- `profiling_data/document_intelligence/week_2024_W52.json` - Weekly records
- `profiling_data/document_intelligence/report_logs.json` - Report generation logs

## Email Reports

Reports include:
- Critical/High/Medium severity issues
- Slow response times
- High memory usage
- P95 threshold violations
- Document type breakdown
- Attached CSV with full details
