"""
Generates CSV report of problematic Document Intelligence endpoints and sends via email.
No Django dependencies - uses smtplib for email.
"""
import csv
import io
import logging
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime, timedelta
from typing import List, Tuple
from .analyzer import ProblematicEndpoint, DocumentIntelligenceProfilingAnalyzer

logger = logging.getLogger(__name__)


class DocumentIntelligenceEmailReporter:
    """Generates and sends email reports for problematic Document Intelligence endpoints."""

    def __init__(self):
        # Try to get from settings first, fallback to environment
        try:
            from config import get_settings
            settings = get_settings()
            recipients_str = settings.DOC_INTEL_PROFILING_REPORT_RECIPIENTS
            self.recipients = [r.strip() for r in recipients_str.split(',') if r.strip()]
            self.smtp_host = settings.SMTP_HOST or 'localhost'
            self.smtp_port = settings.SMTP_PORT
            self.smtp_user = settings.SMTP_USER or ''
            self.smtp_password = settings.SMTP_PASSWORD or ''
            self.from_email = settings.DEFAULT_FROM_EMAIL or 'noreply@example.com'
        except Exception:
            # Fallback to environment variables
            self.recipients = os.getenv('DOC_INTEL_PROFILING_REPORT_RECIPIENTS', '').split(',')
            self.recipients = [r.strip() for r in self.recipients if r.strip()]
            self.smtp_host = os.getenv('SMTP_HOST', 'localhost')
            self.smtp_port = int(os.getenv('SMTP_PORT', '587'))
            self.smtp_user = os.getenv('SMTP_USER', '')
            self.smtp_password = os.getenv('SMTP_PASSWORD', '')
            self.from_email = os.getenv('SMTP_FROM_EMAIL', 'noreply@example.com')

        self.analyzer = DocumentIntelligenceProfilingAnalyzer()

    def generate_csv(self, problems: List[ProblematicEndpoint]) -> str:
        """Generate CSV content from problematic endpoints."""
        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow([
            'severity', 'app_name', 'endpoint', 'method', 'issue_type',
            'metric_value', 'threshold', 'total_requests', 'avg_time_ms',
            'p95_time_ms', 'peak_memory_mb', 'top_slow_function',
            'document_type', 'avg_document_size_kb', 'avg_pages_processed'
        ])

        # Data rows
        for p in problems:
            writer.writerow([
                p.severity, p.app_name, p.endpoint, p.method, p.issue_type,
                p.metric_value, p.threshold, p.total_requests, p.avg_time_ms,
                p.p95_time_ms, p.peak_memory_mb, p.top_slow_function,
                p.document_type, p.avg_document_size_kb, p.avg_pages_processed
            ])

        return output.getvalue()

    def generate_email_body(
        self,
        problems: List[ProblematicEndpoint],
        year: int,
        week_number: int
    ) -> str:
        """Generate HTML email body with summary."""
        critical_count = sum(1 for p in problems if p.severity == 'CRITICAL')
        high_count = sum(1 for p in problems if p.severity == 'HIGH')
        medium_count = sum(1 for p in problems if p.severity == 'MEDIUM')

        # Group by document type
        from collections import defaultdict
        doc_types = defaultdict(list)
        for p in problems:
            doc_types[p.document_type].append(p)

        # Calculate week date range
        first_day = datetime(year, 1, 1)
        week_start = first_day + timedelta(weeks=week_number - 1)
        week_start -= timedelta(days=week_start.weekday())
        week_end = week_start + timedelta(days=6)

        body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        h2 {{ color: #333; }}
        h3 {{ color: #555; margin-top: 20px; }}
        .summary {{ background-color: #f5f5f5; padding: 15px; border-radius: 5px; }}
        .critical {{ color: #d32f2f; font-weight: bold; }}
        .high {{ color: #f57c00; font-weight: bold; }}
        .medium {{ color: #fbc02d; font-weight: bold; }}
        table {{ border-collapse: collapse; width: 100%; margin-top: 10px; }}
        th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        th {{ background-color: #2196F3; color: white; }}
        tr:nth-child(even) {{ background-color: #f2f2f2; }}
        .severity-critical {{ background-color: #ffcdd2; }}
        .severity-high {{ background-color: #ffe0b2; }}
        .severity-medium {{ background-color: #fff9c4; }}
    </style>
</head>
<body>
    <h2>Weekly Document Intelligence Profiling Report - Week {week_number}/{year}</h2>
    <p>Report period: {week_start.strftime('%Y-%m-%d')} to {week_end.strftime('%Y-%m-%d')}</p>

    <div class="summary">
        <h3>Summary</h3>
        <ul>
            <li><span class="critical">CRITICAL:</span> {critical_count} issues</li>
            <li><span class="high">HIGH:</span> {high_count} issues</li>
            <li><span class="medium">MEDIUM:</span> {medium_count} issues</li>
        </ul>
    </div>

    <h3>Issues by Document Type</h3>
    <ul>
"""
        for doc_type, type_problems in doc_types.items():
            body += f"        <li><strong>{doc_type}:</strong> {len(type_problems)} problematic endpoints</li>\n"
        body += "    </ul>\n"

        if problems:
            body += """
    <h3>Top Issues (showing first 10)</h3>
    <table>
        <tr>
            <th>Severity</th>
            <th>Endpoint</th>
            <th>Issue</th>
            <th>Value</th>
            <th>Requests</th>
            <th>Doc Type</th>
            <th>Avg Size (KB)</th>
            <th>Avg Pages</th>
        </tr>
"""
            for p in problems[:10]:
                severity_class = f"severity-{p.severity.lower()}"
                body += f"""        <tr class="{severity_class}">
            <td>{p.severity}</td>
            <td>{p.method} {p.endpoint}</td>
            <td>{p.issue_type}</td>
            <td>{p.metric_value} (threshold: {p.threshold})</td>
            <td>{p.total_requests}</td>
            <td>{p.document_type}</td>
            <td>{p.avg_document_size_kb}</td>
            <td>{p.avg_pages_processed}</td>
        </tr>
"""
            body += "    </table>\n"

        body += """
    <p style="margin-top: 20px;">
        <em>See attached CSV for full details of all problematic endpoints.</em>
    </p>
</body>
</html>
"""
        return body

    def send_report(self, year: int, week_number: int) -> Tuple[bool, str]:
        """Analyze data and send email report."""
        if not self.recipients:
            logger.warning("No recipients configured for Document Intelligence profiling report")
            return False, "No recipients configured (set DOC_INTEL_PROFILING_REPORT_RECIPIENTS)"

        # Analyze data
        problems = self.analyzer.analyze_week(year, week_number)

        if not problems:
            logger.info(f"No problematic Document Intelligence endpoints found for week {week_number}/{year}")
            return True, "No issues found - no email sent"

        # Generate CSV
        csv_content = self.generate_csv(problems)

        # Generate email
        subject = f"[Doc Intel Alert] Week {week_number}/{year} - {len(problems)} Problematic Endpoints Found"
        body = self.generate_email_body(problems, year, week_number)

        # Calculate filename
        first_day = datetime(year, 1, 1)
        week_start = first_day + timedelta(weeks=week_number - 1)
        week_start -= timedelta(days=week_start.weekday())
        filename = f"doc_intel_profiling_issues_week_{week_number}_{week_start.strftime('%Y-%m-%d')}.csv"

        try:
            # Create message
            msg = MIMEMultipart()
            msg['From'] = self.from_email
            msg['To'] = ', '.join(self.recipients)
            msg['Subject'] = subject

            # Attach body
            msg.attach(MIMEText(body, 'html'))

            # Attach CSV
            part = MIMEBase('text', 'csv')
            part.set_payload(csv_content.encode('utf-8'))
            encoders.encode_base64(part)
            part.add_header('Content-Disposition', f'attachment; filename={filename}')
            msg.attach(part)

            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                if self.smtp_user and self.smtp_password:
                    server.starttls()
                    server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)

            # Log the report
            from .db_storage import get_db_storage
            storage = get_db_storage()
            storage.store_report_log({
                'app_name': 'document_intelligence',
                'year': year,
                'week_number': week_number,
                'blob_url': f'email:{",".join(self.recipients)}',
                'records_count': len(problems)
            })

            logger.info(f"Document Intelligence profiling report sent to {len(self.recipients)} recipients")
            return True, f"Email sent to {len(self.recipients)} recipients with {len(problems)} issues"

        except Exception as e:
            logger.error(f"Failed to send Document Intelligence profiling report email: {e}")
            return False, str(e)
