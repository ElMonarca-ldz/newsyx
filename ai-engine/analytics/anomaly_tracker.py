import logging
import math
import json
from typing import Dict, Optional, List
from datetime import datetime
from database.postgres import get_pool # Assuming it's in ai-engine
# Note: In a real scenario we'd use a more robust way to import from siblings
# For this task, I'll follow existing patterns in the ai-engine.

logger = logging.getLogger(__name__)

class WelfordTracker:
    """
    Algoritmo de Welford para calcular media y varianza en un solo paso.
    Permite detectar anomalías (z-score > 2) sin guardar todo el histórico.
    """
    def __init__(self, redis_client=None):
        self.redis = redis_client

    async def _get_state(self, tag: str) -> Dict:
        key = f"anomaly:state:{tag}"
        raw = await self.redis.get(key)
        if raw:
            return json.loads(raw)
        return {"count": 0, "mean": 0.0, "m2": 0.0}

    async def _save_state(self, tag: str, state: Dict):
        key = f"anomaly:state:{tag}"
        await self.redis.set(key, json.dumps(state))

    async def update(self, tag: str, new_value: float):
        state = await self._get_state(tag)
        state["count"] += 1
        n = state["count"]
        delta = new_value - state["mean"]
        state["mean"] += delta / n
        delta2 = new_value - state["mean"]
        state["m2"] += delta * delta2
        await self._save_state(tag, state)

    async def get_z_score(self, tag: str, current_value: float) -> float:
        state = await self._get_state(tag)
        if state["count"] < 5: # Necesitamos al menos 5 puntos para una base estable
            return 0.0
        
        variance = state["m2"] / (state["count"] - 1) if state["count"] > 1 else 0.0
        std_dev = math.sqrt(variance)
        
        if std_dev == 0:
            return 0.0
        
        return (current_value - state["mean"]) / std_dev

async def run_anomaly_detection(redis):
    tracker = WelfordTracker(redis)
    # Tags de interés para monitoreo de picos
    tags = ["economía", "política", "dólar", "inflación", "seguridad"]
    
    anomalies = []
    for tag in tags:
        # Aquí iría la lógica para contar artículos del tag en la última hora
        # Por ahora simulamos la obtención del conteo
        count = await get_article_count_last_hour(tag)
        
        z_score = await tracker.get_z_score(tag, count)
        await tracker.update(tag, count)
        
        if z_score > 2.0:
            anomaly = {
                "tag": tag,
                "count": count,
                "z_score": z_score,
                "timestamp": datetime.utcnow().isoformat(),
                "message": f"Pico inusual detectado en '{tag}': {count} artículos."
            }
            anomalies.append(anomaly)
            # Publicar en Redis para el Situation Monitor
            await redis.publish("situation_monitor:alerts", json.dumps({
                "type": "anomaly",
                "payload": anomaly
            }))
    
    # Persistir la lista completa para consulta vía API (TTL 1 hora)
    if anomalies:
        await redis.setex("intelligence:anomalies:AR", 3600, json.dumps(anomalies))
            
    return anomalies

async def get_article_count_last_hour(tag: str) -> int:
    """
    Query the DB for the number of articles with this tag in the last hour.
    """
    try:
        from database.postgres import get_pool
        pool = await get_pool()
        async with pool.acquire() as conn:
            # We look for Articles analyzed in the last hour that contain the tag in their keywords
            # keywords is part of analysis_data Json
            row = await conn.fetchrow(
                """
                SELECT count(*) 
                FROM news_analysis 
                WHERE status = 'COMPLETED'
                  AND fecha_extraccion >= NOW() - INTERVAL '1 hour'
                  AND analysis_data->'keywords' ? $1
                """,
                tag
            )
            return row['count'] if row else 0
    except Exception as e:
        logger.error(f"Error querying article count for {tag}: {e}")
    return 0
