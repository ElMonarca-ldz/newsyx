import httpx
import logging
import asyncio
from datetime import datetime
from database.postgres import get_db_session
import json

logger = logging.getLogger(__name__)

async def fetch_dolar_blue():
    """
    Fetch Dólar Blue from Bluelytics (Free API).
    """
    url = "https://api.bluelytics.com.ar/v2/latest"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10)
            if response.status_code == 200:
                data = response.json()
                blue = data.get("blue", {})
                oficial = data.get("oficial", {})
                
                return {
                    "value": blue.get("value_sell"),
                    "metadata": {
                        "buy": blue.get("value_buy"),
                        "sell": blue.get("value_sell"),
                        "oficial_sell": oficial.get("value_sell"),
                        "source": "bluelytics"
                    }
                }
    except Exception as e:
        logger.error(f"Error fetching Dólar Blue: {e}")
    return None

async def fetch_riesgo_pais():
    """
    Fetch Riesgo País (EMBI+) - Mocking or Scraping placeholder.
    Note: Real implementation would use FRED API or scraping.
    """
    # Placeholder: In a real scenario, we'd scrap ambito.com or use FRED
    # For now, let's try a simple scraping placeholder logic or a fallback constant
    # return {"value": 1560.0, "metadata": {"change": -12.0, "status": "down"}}
    
    # Simple Ambito scraping attempt (minimalist)
    url = "https://www.ambito.com/contenidos/riesgo-pais.html"
    try:
        async with httpx.AsyncClient() as client:
            # Note: Ambito might have cloudflare/protections, but let's try
            # If it fails, we use a fallback or skip.
            return {"value": 1500.0, "metadata": {"source": "manual_placeholder", "status": "stable"}}
    except Exception as e:
        logger.error(f"Error fetching Riesgo País: {e}")
    return None

async def update_financial_signals():
    """
    Main job to fetch and persist signals.
    """
    dolar = await fetch_dolar_blue()
    riesgo = await fetch_riesgo_pais()
    
    signals = []
    if dolar:
        signals.append(("dolar_blue", dolar["value"], dolar["metadata"]))
    if riesgo:
        signals.append(("riesgo_pais", riesgo["value"], riesgo["metadata"]))
        
    if not signals:
        return
        
    try:
        async with get_db_session() as db:
            for signal_type, value, metadata in signals:
                await db.execute("""
                    INSERT INTO financial_signals (id, type, value, metadata, created_at)
                    VALUES (gen_random_uuid(), $1, $2, $3, $4)
                """, signal_type, value, json.dumps(metadata), datetime.utcnow())
            logger.info(f"Persisted {len(signals)} financial signals")
    except Exception as e:
        logger.error(f"Error persisting financial signals: {e}")

if __name__ == "__main__":
    # Test script
    async def main():
        print("Fetching Dólar Blue...")
        dolar = await fetch_dolar_blue()
        print(f"Result: {dolar}")
        
    asyncio.run(main())
