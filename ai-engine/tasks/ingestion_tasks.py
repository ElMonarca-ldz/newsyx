import asyncio
from tasks.celery_tasks import app

@app.task(name='tasks.ingestion_tasks.run_ingestion_cycle')
def run_ingestion_cycle():
    """Ejecuta el ciclo de ingesta completo."""
    from llm.openrouter_client import OpenRouterClient
    import logging
    logger = logging.getLogger(__name__)
    
    # Check global ingestion switch
    from database.postgres import get_db_session
    
    async def check_global_ingestion():
        try:
            async with get_db_session() as db:
                result = await db.fetchval("SELECT value FROM system_configs WHERE key = 'GLOBAL_INGESTION_ENABLED'")
                return result != 'false'
        except Exception as e:
            logger.error(f"Error checking global ingestion state: {e}")
            return True # Default to true if DB fails

    if not asyncio.run(check_global_ingestion()):
        logger.info("Ingestion cycle skipped: Global switch is OFF.")
        return {"status": "skipped", "reason": "global_switch_off"}

    # Enterprise robustness: stop collection if LLM pipeline is broken
    client = OpenRouterClient()
    if not client.is_healthy():
        logger.warning("Ingestion cycle skipped: OpenRouter circuit breaker is OPEN.")
        return {"status": "skipped", "reason": "circuit_breaker_open"}

    from ingestion.ingestion_manager import IngestionManager
    manager = IngestionManager()
    return asyncio.run(manager.run_ingestion_cycle())

@app.task(name='tasks.ingestion_tasks.run_priority_feeds')
def run_priority_feeds():
    """Placeholder para ingesta prioritaria."""
    print("Running priority feeds ingestion (placeholder)")
    return {"status": "ok"}

@app.task(name='tasks.ingestion_tasks.check_sources_health')
def check_sources_health():
    """Verifica el estado de las fuentes."""
    from ingestion.ingestion_manager import IngestionManager
    manager = IngestionManager()
    print("Checking sources health (placeholder)")
    return {"status": "ok"}
