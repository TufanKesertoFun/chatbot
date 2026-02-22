"""
Database initialization script for profiling tables.
Run this to create the profiling tables in your database.
"""
import sys
import logging
from sqlalchemy import create_engine, inspect
from .db_models import Base, DocumentIntelligenceProfilingRecord, DocumentIntelligenceProfilingReportLog

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def init_profiling_database(connection_string: str = None):
    """
    Initialize profiling database tables.

    Args:
        connection_string: PostgreSQL connection string.
            If None, will use settings from config.py
    """
    try:
        # Get connection string
        if connection_string is None:
            try:
                # Try to get from environment variables directly to avoid settings initialization issues
                import os
                from dotenv import load_dotenv
                from urllib.parse import quote_plus
                load_dotenv()

                username = os.getenv('DATABASE_USERNAME')
                password = os.getenv('DATABASE_PASSWORD')
                host = os.getenv('DATABASE_HOST')
                port = os.getenv('DATABASE_PORT')
                dbname = os.getenv('DATABASE_NAME')

                logger.info(f"Raw DATABASE_USERNAME: {username}")
                logger.info(f"Raw DATABASE_HOST: {host}")
                logger.info(f"Password length: {len(password) if password else 0}")

                if not all([username, password, host, port, dbname]):
                    raise ValueError("Missing database configuration in environment variables")

                # For Azure PostgreSQL, username might already include @hostname
                # Extract just the username part if it contains @
                if '@' in username:
                    username = username.split('@')[0]
                    logger.info(f"Cleaned username: {username}")

                # Also check if host has username in it
                if '@' in host:
                    host = host.split('@')[1]
                    logger.info(f"Cleaned host: {host}")

                # URL encode username and password to handle special characters
                encoded_username = quote_plus(username)
                encoded_password = quote_plus(password)

                connection_string = (
                    f"postgresql://{encoded_username}:{encoded_password}"
                    f"@{host}:{port}/{dbname}"
                )
                logger.info("Using database connection from environment")
            except Exception as e:
                logger.error(f"Failed to get database connection from settings: {e}")
                raise

        # Create engine
        logger.info("Creating database engine...")
        engine = create_engine(connection_string, echo=True)

        # Create profiling schema if it doesn't exist
        with engine.connect() as conn:
            from sqlalchemy import text
            conn.execute(text("CREATE SCHEMA IF NOT EXISTS profiling"))
            conn.commit()
            logger.info("✓ Profiling schema ensured")

        # Check if tables already exist in profiling schema
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names(schema='profiling')

        profiling_tables = ['DocumentIntelligenceProfilingRecord', 'DocumentIntelligenceProfilingReportLog']
        tables_to_create = [t for t in profiling_tables if t not in existing_tables]

        if not tables_to_create:
            logger.info("✓ All profiling tables already exist in profiling schema")
            return True

        logger.info(f"Creating tables in profiling schema: {', '.join(tables_to_create)}")

        # Create tables
        Base.metadata.create_all(engine)

        # Verify tables were created in profiling schema
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names(schema='profiling')

        for table in profiling_tables:
            if table in existing_tables:
                logger.info(f"✓ Table '{table}' created successfully")
            else:
                logger.error(f"✗ Table '{table}' was not created")
                return False

        logger.info("\n✓ Database initialization completed successfully!")
        logger.info("\nYou can now use profiling. Enable it in your .env file:")
        logger.info("  PROFILING_ENABLED=true")
        logger.info("  PROFILING_MEMORY_ENABLED=true")

        return True

    except Exception as e:
        logger.error(f"\n✗ Database initialization failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def drop_profiling_tables(connection_string: str = None):
    """
    Drop profiling tables (use with caution!).

    Args:
        connection_string: PostgreSQL connection string
    """
    try:
        if connection_string is None:
            import os
            from dotenv import load_dotenv
            from urllib.parse import quote_plus
            load_dotenv()

            username = os.getenv('DATABASE_USERNAME')
            password = os.getenv('DATABASE_PASSWORD')
            host = os.getenv('DATABASE_HOST')
            port = os.getenv('DATABASE_PORT')
            dbname = os.getenv('DATABASE_NAME')

            if not all([username, password, host, port, dbname]):
                raise ValueError("Missing database configuration in environment variables")

            # For Azure PostgreSQL, username might already include @hostname
            # Extract just the username part if it contains @
            if '@' in username:
                username = username.split('@')[0]

            # URL encode username and password to handle special characters
            encoded_username = quote_plus(username)
            encoded_password = quote_plus(password)

            connection_string = (
                f"postgresql://{encoded_username}:{encoded_password}"
                f"@{host}:{port}/{dbname}"
            )

        logger.warning("⚠ WARNING: This will DELETE all profiling data!")
        response = input("Type 'yes' to confirm: ")

        if response.lower() != 'yes':
            logger.info("Operation cancelled")
            return False

        engine = create_engine(connection_string, echo=True)
        Base.metadata.drop_all(engine)
        logger.info("✓ Profiling tables dropped successfully")
        return True

    except Exception as e:
        logger.error(f"Failed to drop tables: {e}")
        return False


def check_database_status(connection_string: str = None):
    """Check the status of profiling database tables."""
    try:
        if connection_string is None:
            import os
            from dotenv import load_dotenv
            from urllib.parse import quote_plus
            load_dotenv()

            username = os.getenv('DATABASE_USERNAME')
            password = os.getenv('DATABASE_PASSWORD')
            host = os.getenv('DATABASE_HOST')
            port = os.getenv('DATABASE_PORT')
            dbname = os.getenv('DATABASE_NAME')

            if not all([username, password, host, port, dbname]):
                raise ValueError("Missing database configuration in environment variables")

            # For Azure PostgreSQL, username might already include @hostname
            # Extract just the username part if it contains @
            if '@' in username:
                username = username.split('@')[0]

            # URL encode username and password to handle special characters
            encoded_username = quote_plus(username)
            encoded_password = quote_plus(password)

            connection_string = (
                f"postgresql://{encoded_username}:{encoded_password}"
                f"@{host}:{port}/{dbname}"
            )

        engine = create_engine(connection_string)
        inspector = inspect(engine)

        # Check if profiling schema exists
        from sqlalchemy import text
        with engine.connect() as conn:
            result = conn.execute(text("SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'profiling'"))
            schema_exists = result.fetchone() is not None

        if not schema_exists:
            logger.info("✗ Profiling schema does not exist")
            logger.info("Run 'python init_database.py init' to create it")
            return False

        existing_tables = inspector.get_table_names(schema='profiling')

        profiling_tables = ['DocumentIntelligenceProfilingRecord', 'DocumentIntelligenceProfilingReportLog']

        logger.info("\n=== Profiling Database Status ===")
        logger.info(f"Schema: profiling (exists)")
        for table in profiling_tables:
            if table in existing_tables:
                # Get row count
                with engine.connect() as conn:
                    result = conn.execute(text(f"SELECT COUNT(*) FROM profiling.\"{table}\""))
                    count = result.scalar()
                logger.info(f"✓ profiling.{table}: EXISTS ({count} records)")

                # Get columns
                columns = inspector.get_columns(table, schema='profiling')
                logger.info(f"  Columns: {len(columns)}")
                for col in columns[:5]:  # Show first 5 columns
                    logger.info(f"    - {col['name']} ({col['type']})")
                if len(columns) > 5:
                    logger.info(f"    ... and {len(columns) - 5} more")
            else:
                logger.info(f"✗ profiling.{table}: NOT FOUND")

        logger.info("\nDatabase connection: OK")
        return True

    except Exception as e:
        logger.error(f"Failed to check database status: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Manage profiling database tables')
    parser.add_argument('action', choices=['init', 'drop', 'status'],
                       help='Action to perform: init (create tables), drop (delete tables), status (check tables)')
    parser.add_argument('--connection-string', help='Database connection string (optional)')

    args = parser.parse_args()

    if args.action == 'init':
        success = init_profiling_database(args.connection_string)
        sys.exit(0 if success else 1)
    elif args.action == 'drop':
        success = drop_profiling_tables(args.connection_string)
        sys.exit(0 if success else 1)
    elif args.action == 'status':
        success = check_database_status(args.connection_string)
        sys.exit(0 if success else 1)
