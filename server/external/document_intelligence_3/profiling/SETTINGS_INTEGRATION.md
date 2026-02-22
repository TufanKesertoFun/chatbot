# Profiling Settings Integration

## ✅ Changes Made

### 1. Added to `config.py` Settings Class

All profiling configuration is now centralized in your `Settings` class:

```python
# Profiling Configuration
PROFILING_ENABLED: bool = os.getenv('PROFILING_ENABLED', 'false').lower() == 'true'
PROFILING_MEMORY_ENABLED: bool = os.getenv('PROFILING_MEMORY_ENABLED', 'false').lower() == 'true'
PROFILING_MIN_TIME_MS: int = int(os.getenv('PROFILING_MIN_TIME_MS', '100'))
PROFILING_STORAGE_DIR: str = os.getenv('PROFILING_STORAGE_DIR', 'profiling_data/document_intelligence')

# Document Intelligence Profiling Thresholds
DOC_INTEL_PROFILING_SLOW_THRESHOLD_MS: int = int(os.getenv('DOC_INTEL_PROFILING_SLOW_THRESHOLD_MS', '1000'))
DOC_INTEL_PROFILING_MEMORY_THRESHOLD_MB: float = float(os.getenv('DOC_INTEL_PROFILING_MEMORY_THRESHOLD_MB', '50'))
DOC_INTEL_PROFILING_P95_THRESHOLD_MS: int = int(os.getenv('DOC_INTEL_PROFILING_P95_THRESHOLD_MS', '2000'))
DOC_INTEL_PROFILING_REPORT_RECIPIENTS: str = os.getenv('DOC_INTEL_PROFILING_REPORT_RECIPIENTS', '')
```

### 2. Updated Profiling Modules

All profiling modules now:
1. **Try to read from Settings first** (using `get_settings()`)
2. **Fallback to environment variables** if Settings fails
3. **Maintain backward compatibility**

Updated files:
- `profiling.py` - Core profiling functions
- `storage.py` - Storage initialization
- `analyzer.py` - Threshold configuration
- `email_report.py` - Email and SMTP settings

## Configuration

### Option 1: Add to `.env` File (Recommended)

Add these to your `.env` file:

```bash
# Document Intelligence Profiling
PROFILING_ENABLED=true
PROFILING_MEMORY_ENABLED=true
PROFILING_MIN_TIME_MS=100
PROFILING_STORAGE_DIR=profiling_data/document_intelligence

# Profiling Thresholds
DOC_INTEL_PROFILING_SLOW_THRESHOLD_MS=1000
DOC_INTEL_PROFILING_MEMORY_THRESHOLD_MB=50
DOC_INTEL_PROFILING_P95_THRESHOLD_MS=2000

# Email Reports (Optional)
DOC_INTEL_PROFILING_REPORT_RECIPIENTS=dev@example.com,ops@example.com
```

### Option 2: Set Environment Variables

```powershell
# Windows PowerShell
$env:PROFILING_ENABLED="true"
$env:PROFILING_MEMORY_ENABLED="true"
$env:PROFILING_MIN_TIME_MS="100"
```

### Option 3: Access via Settings in Code

```python
from config import get_settings

settings = get_settings()

print(f"Profiling enabled: {settings.PROFILING_ENABLED}")
print(f"Storage directory: {settings.PROFILING_STORAGE_DIR}")
print(f"Slow threshold: {settings.DOC_INTEL_PROFILING_SLOW_THRESHOLD_MS}ms")
```

## Benefits of Settings Integration

### 1. **Centralized Configuration**
- All settings in one place (`config.py`)
- Consistent with your backend architecture
- Easy to find and modify

### 2. **Type Safety**
- Pydantic validation ensures correct types
- Auto-conversion (str → int, bool, etc.)
- IDE autocomplete support

### 3. **Default Values**
- Sensible defaults built-in
- No need to set every variable
- Fail-safe operation

### 4. **Backward Compatible**
- Still reads from environment if Settings unavailable
- No breaking changes
- Works in all scenarios

## Usage Example

```python
from config import get_settings
from Managers.Document_Intelligence_3.profiling.storage import get_storage

# Settings are automatically loaded
settings = get_settings()

# Profiling configuration is ready
if settings.PROFILING_ENABLED:
    print("Profiling is enabled!")
    print(f"Data stored in: {settings.PROFILING_STORAGE_DIR}")

# Storage uses settings automatically
storage = get_storage()
records = storage.get_records(2026, 4)
print(f"Found {len(records)} profiling records")
```

## Settings Reference

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `PROFILING_ENABLED` | bool | false | Enable/disable profiling |
| `PROFILING_MEMORY_ENABLED` | bool | false | Track memory usage |
| `PROFILING_MIN_TIME_MS` | int | 100 | Minimum time to store (ms) |
| `PROFILING_STORAGE_DIR` | str | profiling_data/... | Where to store JSON files |
| `DOC_INTEL_PROFILING_SLOW_THRESHOLD_MS` | int | 1000 | Slow response threshold |
| `DOC_INTEL_PROFILING_MEMORY_THRESHOLD_MB` | float | 50 | High memory threshold |
| `DOC_INTEL_PROFILING_P95_THRESHOLD_MS` | int | 2000 | P95 latency threshold |
| `DOC_INTEL_PROFILING_REPORT_RECIPIENTS` | str | '' | Comma-separated email list |

## Email Configuration

The email reporter uses existing SMTP settings from your config:

```python
# From config.py Settings class
SMTP_HOST: str = os.getenv("SMTP_HOST", "")
SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER: str = os.getenv("SMTP_USER", "")
SMTP_PASSWORD: Optional[str] = os.getenv("SMTP_PASSWORD")
DEFAULT_FROM_EMAIL: str = os.getenv("DEFAULT_FROM_EMAIL", "")
```

No duplicate configuration needed!

## Testing

```python
# Test that settings are loaded
from config import get_settings

settings = get_settings()
print("Profiling Settings:")
print(f"  Enabled: {settings.PROFILING_ENABLED}")
print(f"  Memory: {settings.PROFILING_MEMORY_ENABLED}")
print(f"  Min Time: {settings.PROFILING_MIN_TIME_MS}ms")
print(f"  Storage: {settings.PROFILING_STORAGE_DIR}")
print(f"  Slow Threshold: {settings.DOC_INTEL_PROFILING_SLOW_THRESHOLD_MS}ms")
print(f"  Memory Threshold: {settings.DOC_INTEL_PROFILING_MEMORY_THRESHOLD_MB}MB")
print(f"  P95 Threshold: {settings.DOC_INTEL_PROFILING_P95_THRESHOLD_MS}ms")
print(f"  Email Recipients: {settings.DOC_INTEL_PROFILING_REPORT_RECIPIENTS}")
```

## Migration Notes

**No migration needed!** The system is backward compatible:

- Existing environment variables still work
- Settings class reads from `.env` automatically
- Fallback mechanism ensures it always works

Just add the settings to your `.env` file and you're done!
