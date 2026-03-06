import os
import asyncpg
import logging
from contextlib import asynccontextmanager

DATABASE_URL = os.environ.get("DATABASE_URL")
_pool = None

logger = logging.getLogger(__name__)

async def get_pool():
    """
    Returns a global asyncpg connection pool.
    """
    global _pool
    if _pool is None:
        if not DATABASE_URL:
            raise RuntimeError("DATABASE_URL environment variable is not set")
        logger.info("Initializing asyncpg connection pool...")
        _pool = await asyncpg.create_pool(dsn=DATABASE_URL)
    return _pool

@asynccontextmanager
async def get_db_session():
    """
    Yields a connection, prioritizes using the global pool if available,
    otherwise creates a one-off connection.
    This fulfills both long-running uvicorn needs and one-off Celery needs.
    """
    global _pool
    conn = None
    
    # Intenta usar el pool
    if _pool:
        async with _pool.acquire() as pool_conn:
            yield pool_conn
            return

    # Si no hay pool (ej: en un test rápido o Celery manual), crea conexión individual
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL environment variable not set")
        
    logger.debug("Opening one-off asyncpg connection...")
    conn = await asyncpg.connect(dsn=DATABASE_URL)
    try:
        yield conn
    finally:
        await conn.close()
