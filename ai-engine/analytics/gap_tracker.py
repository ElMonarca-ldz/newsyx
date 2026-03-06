import asyncio
import logging
import json
from datetime import datetime, timedelta
from database.postgres import get_db_session

logger = logging.getLogger(__name__)

class GapTracker:
    """
    Intelligence Gap Tracker.
    Detects silent sources, stalled analysis, and unusual topic silences.
    """
    
    def __init__(self, country: str = "AR"):
        self.country = country
        # Thresholds by tier (hours)
        self.source_thresholds = {
            1: 4,  # Agencias / Oficiales (4h)
            2: 6,  # Nacionales (6h)
            3: 12, # Especializados (12h)
            4: 24  # Agregadores (24h)
        }

    async def get_silent_sources(self, db):
        """
        Identify active sources that haven't ingested news in their expected timeframe.
        """
        query = """
            SELECT id, nombre, tier, ultima_ingesta
            FROM rss_feeds
            WHERE activo = true AND (pais = $1 OR pais = 'GLOBAL')
        """
        sources = await db.fetch(query, self.country)
        gaps = []
        now = datetime.utcnow()

        for source in sources:
            last_ingesta = source['ultima_ingesta']
            if not last_ingesta:
                continue
                
            tier = source['tier']
            threshold_hours = self.source_thresholds.get(tier, 12)
            
            if now - last_ingesta > timedelta(hours=threshold_hours):
                silent_hours = int((now - last_ingesta).total_seconds() / 3600)
                severity = "danger" if silent_hours > threshold_hours * 2 else "warning"
                
                gaps.append({
                    "type": "source_silent",
                    "severity": severity,
                    "message": f"Fuente {source['nombre']} (Tier {tier}) sin noticias hace {silent_hours}h",
                    "source_id": source['id'],
                    "detected_at": now.isoformat()
                })
        
        return gaps

    async def get_stalled_analyses(self, db):
        """
        Identify analyses stuck in PENDING or PROCESSING state for too long.
        """
        # Threshold for analysis is 15 minutes
        threshold = datetime.utcnow() - timedelta(minutes=15)
        query = """
            SELECT COUNT(*)
            FROM news_analysis
            WHERE status IN ('PENDING', 'PROCESSING') AND created_at < $1
        """
        count = await db.fetchval(query, threshold)
        
        if count > 0:
            return [{
                "type": "analysis_stalled",
                "severity": "danger" if count > 10 else "warning",
                "message": f"{count} análisis estancados en cola (>15 min)",
                "count": count,
                "detected_at": datetime.utcnow().isoformat()
            }]
        return []

    async def get_all_gaps(self):
        """
        Aggregate all detected gaps.
        """
        async with get_db_session() as db:
            silent_sources = await self.get_silent_sources(db)
            stalled_analyses = await self.get_stalled_analyses(db)
            
            return silent_sources + stalled_analyses

async def main():
    tracker = GapTracker()
    gaps = await tracker.get_all_gaps()
    print(json.dumps(gaps, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
