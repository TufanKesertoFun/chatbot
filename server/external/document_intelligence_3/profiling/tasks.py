"""
Scheduled tasks for Document Intelligence profiling report generation and cleanup.
Can be run manually or scheduled with cron/systemd timers.
"""
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


def send_weekly_doc_intel_profiling_report():
    """
    Analyze Document Intelligence profiling data and send email report for problematic endpoints.
    Should run every Monday, analyzes data for the previous week.
    """
    from .email_report import DocumentIntelligenceEmailReporter

    # Calculate previous week's year and week number
    now = datetime.now()
    last_week = now - timedelta(days=7)
    year = last_week.year
    week_number = last_week.isocalendar()[1]

    logger.info(f"Generating Document Intelligence profiling report for week {week_number}/{year}")

    try:
        reporter = DocumentIntelligenceEmailReporter()
        success, message = reporter.send_report(year, week_number)

        if success:
            logger.info(f"Weekly Document Intelligence profiling report: {message}")
        else:
            logger.error(f"Failed to send Document Intelligence profiling report: {message}")

        return {'success': success, 'message': message}

    except Exception as e:
        logger.error(f"Error in Document Intelligence profiling report task: {e}")
        return {'success': False, 'message': str(e)}


def cleanup_old_doc_intel_profiling_records(days_to_keep: int = 90):
    """
    Clean up old Document Intelligence profiling records to prevent storage bloat.
    Keeps records for the specified number of days.
    """
    from .db_storage import get_db_storage

    try:
        storage = get_db_storage()
        deleted_count = storage.cleanup_old_records(days_to_keep)

        logger.info(f"Deleted {deleted_count} old Document Intelligence profiling files (older than {days_to_keep} days)")
        return {'success': True, 'deleted_count': deleted_count}

    except Exception as e:
        logger.error(f"Error cleaning up Document Intelligence profiling records: {e}")
        return {'success': False, 'message': str(e)}


if __name__ == '__main__':
    # Allow running directly for testing or cron
    import sys

    if len(sys.argv) > 1:
        if sys.argv[1] == 'report':
            result = send_weekly_doc_intel_profiling_report()
            print(f"Report task result: {result}")
        elif sys.argv[1] == 'cleanup':
            days = int(sys.argv[2]) if len(sys.argv) > 2 else 90
            result = cleanup_old_doc_intel_profiling_records(days)
            print(f"Cleanup task result: {result}")
        else:
            print("Usage: python tasks.py [report|cleanup] [days_to_keep]")
    else:
        print("Usage: python tasks.py [report|cleanup] [days_to_keep]")
