from fastapi import FastAPI
from contextlib import asynccontextmanager
import logging
# Real imports
from ingestion.ingestion_manager import IngestionManager
from database.postgres import get_pool

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing AI Engine...")
    await get_pool() # Initialize DB pool
    yield
    # Shutdown
    logger.info("Shutting down AI Engine...")

app = FastAPI(title="Newsyx AI Engine", lifespan=lifespan)

import json
from fastapi.responses import StreamingResponse
from agents.orchestrator import analyze_article_stream

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "ai-engine"}

@app.post("/ingest/trigger")
async def trigger_ingestion():
    """Manually trigger ingestion cycle."""
    manager = IngestionManager()
    result = await manager.run_ingestion_cycle()
    return result

@app.get("/analyze/stream")
async def stream_analysis(url: str):
    """
    Stream analysis results for a given URL via SSE.
    """
    # In a real scenario, we might need some basic metadata about the article
    # for the initial state. For now, we'll pass an empty dict as raw_article_data.
    # The scraper node will handle fetching the content.
    
    async def event_generator():
        async for update in analyze_article_stream(url, {}):
            yield f"data: {json.dumps(update)}\n\n"
        yield "data: {\"done\": true}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
