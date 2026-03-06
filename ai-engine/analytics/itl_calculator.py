import asyncio
import logging
import json
from datetime import datetime, timedelta
from database.postgres import get_db_session

logger = logging.getLogger(__name__)

class ITLCalculator:
    """
    Index of Tension/Intelligence Calculator.
    Aggregates metrics from recent news analysis to generate a country-level score.
    """
    
    def __init__(self, country: str = "AR", window_hours: int = 24):
        self.country = country
        self.window_hours = window_hours
        # Weights for the components (should sum to 1.0)
        self.weights = {
            "desinformacion": 0.35,
            "negatividad": 0.30,
            "sesgo": 0.20,
            "tension_eventos": 0.15
        }

    async def get_recent_analyses(self, db, limit: int = 50):
        """
        Fetch last N analyses for the country within the time window.
        """
        since = datetime.utcnow() - timedelta(hours=self.window_hours)
        query = """
            SELECT titular, score_desinformacion, sentimiento_score, score_sesgo, geo_intelligence, event_id
            FROM news_analyses
            WHERE pais = $1 AND created_at > $2
            ORDER BY created_at DESC
            LIMIT $3
        """
        return await db.fetch(query, self.country, since, limit)

    def calculate_score(self, analyses):
        if not analyses:
            return 0.0, {}, []

        total_desin = 0.0
        total_negatividad = 0.0
        total_sesgo = 0.0
        event_count = 0
        
        drivers = []

        for row in analyses:
            # Desinformacion (0-1)
            total_desin += row['score_desinformacion'] or 0.0
            
            # Negatividad: Sentiment score is usually -1 to 1. 
            # We map -1 (very neg) -> 1.0, and 1 (very pos) -> 0.0
            sent = row['sentimiento_score'] or 0.0
            neg = max(0.0, (1.0 - sent) / 2.0)
            total_negatividad += neg
            
            # Sesgo (0-1)
            total_sesgo += row['score_sesgo'] or 0.0
            
            # Tension: linked to events
            if row['event_id']:
                event_count += 1
            
            # Track top drivers (titles of high-tension articles)
            tension_article = (row['score_desinformacion'] or 0.0) + neg
            drivers.append((row['titular'], tension_article))

        count = len(analyses)
        avg_desin = total_desin / count
        avg_neg = total_negatividad / count
        avg_sesgo = total_sesgo / count
        event_density = min(1.0, event_count / count * 5) # Normalize event density

        final_score = (
            avg_desin * self.weights["desinformacion"] +
            avg_neg * self.weights["negatividad"] +
            avg_sesgo * self.weights["sesgo"] +
            event_density * self.weights["tension_eventos"]
        ) * 100 # Scale to 0-100

        components = {
            "desinformacion": round(avg_desin, 3),
            "negatividad": round(avg_neg, 3),
            "sesgo": round(avg_sesgo, 3),
            "tension_eventos": round(event_density, 3)
        }

        # Get top 3 drivers
        top_drivers = [d[0] for d in sorted(drivers, key=lambda x: x[1], reverse=True)[:3]]

        return round(final_score, 2), components, top_drivers

    async def get_latest_score_and_trend(self, db, current_score: float):
        query = """
            SELECT score FROM country_scores 
            WHERE country = $1 
            ORDER BY created_at DESC 
            LIMIT 1
        """
        last_row = await db.fetchrow(query, self.country)
        if not last_row:
            return "stable"
        
        last_score = last_row['score']
        diff = current_score - last_score
        
        if diff > 2.0: return "up"
        if diff < -2.0: return "down"
        return "stable"

    async def run_and_persist(self):
        async with get_db_session() as db:
            analyses = await self.get_recent_analyses(db)
            if not analyses:
                logger.info(f"No recent analyses found for {self.country} to calculate ITL.")
                return

            score, components, top_drivers = self.calculate_score(analyses)
            trend = await self.get_latest_score_and_trend(db, score)

            await db.execute("""
                INSERT INTO country_scores (id, country, score, components, trend, top_drivers, created_at)
                VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
            """, self.country, score, json.dumps(components), trend, top_drivers, datetime.utcnow())
            
            logger.info(f"Calculated ITL for {self.country}: {score} ({trend})")
            return {"country": self.country, "score": score, "trend": trend}

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    calc = ITLCalculator()
    asyncio.run(calc.run_and_persist())
