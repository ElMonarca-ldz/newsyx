from tasks.celery_tasks import app

@app.task(name='tasks.maintenance_tasks.cleanup_old_cache')
def cleanup_old_cache():
    """Limpia caché antiguo."""
    print("Cleaning up old cache (placeholder)")
    return {"status": "ok"}

@app.task(name='tasks.maintenance_tasks.openrouter_watchdog')
def openrouter_watchdog():
    """Enterprise watchdog for OpenRouter health."""
    from llm.openrouter_client import OpenRouterClient
    import logging
    import asyncio
    
    logger = logging.getLogger(__name__)
    client = OpenRouterClient()
    
    if client.is_healthy():
        return {"status": "healthy"}
        
    logger.info("Watchdog: OpenRouter is in degraded state. Testing recovery...")
    
    from pydantic import BaseModel
    class HealthCheck(BaseModel):
        ok: bool
        
    try:
        # Test request to see if it's back
        asyncio.run(client.complete_structured(
            system_prompt="Return a JSON with ok=true",
            user_content="ping",
            output_schema=HealthCheck,
            max_tokens=20
        ))
        logger.info("Watchdog: OpenRouter recovery SUCCESS. Circuit breaker CLOSED.")
        return {"status": "recovered"}
    except Exception as e:
        logger.warning(f"Watchdog: OpenRouter recovery FAILED: {e}")
        return {"status": "still_degraded", "error": str(e)}

@app.task(name='tasks.maintenance_tasks.fetch_financial_signals')
def fetch_financial_signals():
    """Enterprise job for AR financial indicators."""
    from services.financial_signals import update_financial_signals
    import asyncio
    asyncio.run(update_financial_signals())
    return {"status": "ok"}

@app.task(name='tasks.maintenance_tasks.calculate_itl_score')
def calculate_itl_score(country: str = "AR"):
    """Enterprise hourly calculation of ITL Score."""
    from analytics.itl_calculator import ITLCalculator
    import asyncio
    calc = ITLCalculator(country=country)
    result = asyncio.run(calc.run_and_persist())
    return result or {"status": "no_data"}

@app.task(name='tasks.maintenance_tasks.track_intelligence_gaps')
def track_intelligence_gaps(country: str = "AR"):
    """Identify and store intelligence gaps in Redis."""
    from analytics.gap_tracker import GapTracker
    import asyncio
    import json
    
    async def _run():
        tracker = GapTracker(country=country)
        gaps = await tracker.get_all_gaps()
        
        from redis_client import redis
        redis.setex(f"intelligence:gaps:{country}", 3600, json.dumps(gaps))
        return {"status": "ok", "gaps_found": len(gaps)}
    
    return asyncio.run(_run())

@app.task(name='tasks.maintenance_tasks.calculate_focal_points')
def calculate_focal_points(country: str = "AR"):
    """Identify and store focal points in Redis."""
    from analytics.focal_point_detector import FocalPointDetector
    import asyncio
    import json
    
    async def _run():
        detector = FocalPointDetector(country=country)
        focal_points = await detector.run()
        
        from redis_client import redis
        redis.setex(f"intelligence:focal_points:{country}", 3600, json.dumps(focal_points))
        return {"status": "ok", "focal_points_found": len(focal_points)}
    
    return asyncio.run(_run())


@app.task(name='tasks.maintenance_tasks.run_anomaly_detection')
def run_anomaly_detection_job(country: str = "AR"):
    """Predictive job for detecting spikes in article volume."""
    from analytics.anomaly_tracker import run_anomaly_detection
    from redis_client import redis
    import asyncio
    return asyncio.run(run_anomaly_detection(redis))
