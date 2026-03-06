"""
Dynamic Twitter scheduler — runs every minute via Celery Beat.
Determines which profiles need scraping based on tier intervals
and per-profile scrapeInterval overrides.
"""
import asyncio
import os
import logging
from datetime import datetime, timedelta
from celery import shared_task

logger = logging.getLogger(__name__)

TIER_INTERVALS = {"S": 5, "A": 10, "B": 15, "C": 30}
BACKEND_URL = os.environ.get("BACKEND_URL", "http://backend:4000")


@shared_task(name='tasks.twitter_scheduler.dispatch_twitter_scrape_jobs')
def dispatch_twitter_scrape_jobs():
    """
    Corre cada minuto (configurado en Celery Beat).
    Determina qué perfiles necesitan ser scrapeados y
    los encola con la prioridad correcta.
    """
    asyncio.run(_dispatch_async())


@shared_task(name='tasks.twitter_scheduler.sync_twitter_accounts')
def sync_twitter_accounts():
    """
    Corre cada 5 minutos para sincronizar credenciales 
    desde el backend hacia twscrape.
    """
    asyncio.run(_sync_accounts_async())


async def _sync_accounts_async():
    from services.twitter.account_pool import pool_manager
    await pool_manager.initialize() # Ensure it's active
    await pool_manager.sync_accounts()


async def _dispatch_async():
    import httpx

    try:
        async with httpx.AsyncClient(base_url=BACKEND_URL, timeout=30) as client:
            resp = await client.get("/api/twitter/profiles")
            if resp.status_code != 200:
                logger.error(f"[TwitterScheduler] Failed to fetch profiles: {resp.status_code}")
                return
            profiles = resp.json()
    except Exception as e:
        logger.error(f"[TwitterScheduler] Error fetching profiles: {e}")
        return

    now = datetime.utcnow()
    dispatched = 0

    for profile in profiles:
        # Skip disabled or too many failures
        if not profile.get("scrapeEnabled", True) or not profile.get("isActive", True):
            continue
        if profile.get("consecutiveFails", 0) >= 5:
            continue

        # Determine interval
        interval_min = profile.get("scrapeInterval") or TIER_INTERVALS.get(profile.get("tier", "C"), 30)

        # Parse lastScrapedAt
        last_scraped = profile.get("lastScrapedAt")
        if last_scraped:
            try:
                last_scraped_dt = datetime.fromisoformat(last_scraped.replace("Z", "+00:00")).replace(tzinfo=None)
            except (ValueError, AttributeError):
                last_scraped_dt = datetime.min
        else:
            last_scraped_dt = datetime.min

        next_scrape = last_scraped_dt + timedelta(minutes=interval_min)

        if now >= next_scrape:
            # Import here to avoid circular imports
            from tasks.twitter_scraper import scrape_profile_tweets

            # Celery priority: lower number = higher priority
            priority = {"S": 1, "A": 3, "B": 5, "C": 7}.get(profile.get("tier", "C"), 5)
            scrape_profile_tweets.apply_async(
                args=[profile["id"]],
                priority=priority,
                queue="twitter_scrape",
            )
            dispatched += 1

    if dispatched:
        logger.info(f"[TwitterScheduler] Dispatched {dispatched} scrape jobs")
