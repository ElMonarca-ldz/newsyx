import asyncio
import logging
import json
from collections import defaultdict
from datetime import datetime, timedelta
from database.postgres import get_db_session

logger = logging.getLogger(__name__)

class FocalPointDetector:
    """
    Focal Point Detector.
    Identifies entities (people, orgs, places) that are gaining significant attention.
    """
    
    def __init__(self, country: str = "AR", window_hours: int = 12):
        self.country = country
        self.window_hours = window_hours

    async def get_recent_analyses(self, db):
        since = datetime.utcnow() - timedelta(hours=self.window_hours)
        query = """
            SELECT id, titular, sentimiento_score, score_desinformacion, geo_intelligence, analysis_data
            FROM news_analysis
            WHERE (pais = $1 OR pais = 'GLOBAL') AND created_at > $2
        """
        return await db.fetch(query, self.country, since)

    def calculate_focal_points(self, analyses):
        entity_signals = defaultdict(lambda: {
            "mentions": 0,
            "sentiment_sum": 0,
            "alarmism_sum": 0,
            "type": "entity",
            "articles": []
        })

        for ann in analyses:
            data = ann['analysis_data']
            sentiment = ann['sentimiento_score'] or 0.5
            # Extract alarmism from intention (if available in analysisData)
            alarmism = data.get('intencion_editorial', {}).get('score_alarmismo', 0.5)
            
            # 1. Process actors from "voces_incluidas"
            actors = data.get('sesgo', {}).get('voces_incluidas', [])
            for actor_data in actors:
                name = actor_data.get('actor')
                if name:
                    s = entity_signals[name]
                    s["mentions"] += 1
                    s["sentiment_sum"] += sentiment
                    s["alarmism_sum"] += alarmism
                    s["type"] = "actor"
                    s["articles"].append(ann['id'])

            # 2. Process locations from geo_intelligence
            geo = ann['geo_intelligence'] or {}
            locations = geo.get('lugares_mencionados', [])
            for loc in locations:
                name = loc.get('nombre_display')
                if name and loc.get('confianza_geo', 0) > 0.7:
                    s = entity_signals[name]
                    s["mentions"] += 1
                    s["sentiment_sum"] += sentiment
                    s["alarmism_sum"] += alarmism
                    s["type"] = "location"
                    s["articles"].append(ann['id'])

        focal_points = []
        total_articles = len(analyses)
        if total_articles == 0:
            return []

        for name, signals in entity_signals.items():
            if signals["mentions"] < 2:
                continue
                
            mention_score = min(1.0, signals["mentions"] / (total_articles * 0.5 + 1))
            avg_sentiment = signals["sentiment_sum"] / signals["mentions"]
            # Impact is deviation from neutral (0.5)
            sentiment_impact = abs(0.5 - avg_sentiment) * 2
            avg_alarmism = signals["alarmism_sum"] / signals["mentions"]
            
            # Focal Score weighted (Mentions 40%, Sentiment Impact 30%, Alarmism 30%)
            focal_score = (mention_score * 0.4) + (sentiment_impact * 0.3) + (avg_alarmism * 0.3)
            
            focal_points.append({
                "name": name,
                "type": signals["type"],
                "score": round(focal_score, 3),
                "mentions": signals["mentions"],
                "trend": "emerging" if focal_score > 0.6 else "stable",
                "signals": {
                    "sentiment": round(avg_sentiment, 2),
                    "alarmism": round(avg_alarmism, 2)
                }
            })

        return sorted(focal_points, key=lambda x: x['score'], reverse=True)[:15]

    async def run(self):
        async with get_db_session() as db:
            analyses = await self.get_recent_analyses(db)
            return self.calculate_focal_points(analyses)

async def main():
    detector = FocalPointDetector()
    results = await detector.run()
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
