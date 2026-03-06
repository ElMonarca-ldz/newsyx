import os
import asyncio
from celery import Celery

# Create the shared Celery app
app = Celery('ai-engine')
app.config_from_object('celeryconfig')

# Import all task modules so they are registered
app.autodiscover_tasks([
    'tasks.ingestion_tasks',
    'tasks.maintenance_tasks',
    'tasks.twitter_scraper',
    'tasks.twitter_scheduler',
    'tasks.tweet_analyzer',
])

# ─── ANALYSIS TASK ───────────────────────────────────────────────────────────

@app.task(
    name='tasks.celery_tasks.analyze_article_task', 
    bind=True, 
    max_retries=5,
    acks_late=True, # No confirmar hasta terminar exitosamente
    rate_limit='20/m' # Evitar ban de APIs de LLM
)
def analyze_article_task(self, url: str, raw_article_data: dict):
    """
    Celery task to analyse a single news article via the LangGraph orchestrator.
    """
    from agents.orchestrator import analyze_article
    import logging
    logger = logging.getLogger(__name__)

    logger.info(f"Analyzing article [{self.request.id}]: {url}")
    
    from utils.circuit_breaker import CircuitBreakerOpenError
    
    # Correr en el event loop principal del threadworker de Celery con un timeout de 10 minutos
    try:
        result = asyncio.run(asyncio.wait_for(analyze_article(url, raw_article_data), timeout=600))
    except asyncio.TimeoutError:
        logger.error(f"Analysis task for {url} timed out after 10 minutes.")
        return {"status": "failed", "reason": "timeout", "url": url}
    
    try:
        # Verificar si hubo errores en el grafo
        if result.get("errors"):
            logger.error(f"Graph errors for {url}: {result['errors']}")
            
            # Enterprise logic: If LLM failed because circuit is open, trigger the special retry
            if any("Circuit Breaker" in str(e) for e in result["errors"]):
                raise CircuitBreakerOpenError("Circuit Breaker open in graph node")

            # Si el error es temporal (timeout), reintentar
            if any("timeout" in str(e).lower() for e in result["errors"]):
                raise self.retry(countdown=60 * (self.request.retries + 1))

        return {"status": "success", "url": url, "steps": result.get("steps_completed")}
        
    except CircuitBreakerOpenError as exc:
        # Si el circuito está abierto, reintentar en 15 minutos (900 seg)
        logger.warning(f"Circuit breaker OPEN for {url}, postponement of 15m")
        raise self.retry(exc=exc, countdown=900)
        
    except Exception as exc:
        logger.warning(f"Retrying analysis for {url} due to: {exc}")
        # Reintento exponencial simple
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))
