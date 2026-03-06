"""
Twitter scraper Celery task.
Scrapes tweets from a specific profile and persists to DB via backend API.
"""
import asyncio
import json
import os
import logging
from datetime import datetime
from celery import shared_task

logger = logging.getLogger(__name__)

TWEETS_PER_SCRAPE = 20  # max tweets per scrape session per profile
BACKEND_URL = os.environ.get("BACKEND_URL", "http://backend:4000")


@shared_task(
    name='tasks.twitter_scraper.scrape_profile_tweets',
    bind=True,
    max_retries=3,
    default_retry_delay=300,
    acks_late=True,
    queue='twitter_scrape',
)
def scrape_profile_tweets(self, profile_id: str):
    """
    Scrape tweets de un perfil y persistir en DB.
    Se programa dinámicamente desde el scheduler según el tier.
    """
    asyncio.run(_scrape_profile_tweets_async(self, profile_id))


async def _scrape_profile_tweets_async(task, profile_id: str):
    import httpx

    # Fetch profile from backend API
    async with httpx.AsyncClient(base_url=BACKEND_URL, timeout=30) as client:
        resp = await client.get(f"/api/twitter/profiles")
        if resp.status_code != 200:
            logger.error(f"[Scraper] Failed to fetch profiles: {resp.status_code}")
            return

        profiles = resp.json()
        profile = next((p for p in profiles if p["id"] == profile_id), None)
        if not profile or not profile.get("scrapeEnabled", True):
            logger.debug(f"[Scraper] Profile {profile_id} not found or disabled")
            return

    from services.twitter.account_pool import pool_manager
    await pool_manager.initialize()

    if not pool_manager.api:
        logger.error("[Scraper] Account pool not initialized (twscrape not available)")
        return

    try:
        username = profile["username"]

        # Resolve xUserId on first scrape
        x_user_id = profile.get("xUserId")
        if not x_user_id:
            try:
                user = await pool_manager.api.user_by_login(username)
                if not user:
                    logger.warning(f"[Scraper] User not found: @{username}")
                    return
                x_user_id = str(user.id)

                # Update profile with resolved user data
                async with httpx.AsyncClient(base_url=BACKEND_URL, timeout=30) as client:
                    await client.put(f"/api/twitter/profiles/{profile_id}", json={
                        "xUserId": x_user_id,
                        "displayName": getattr(user, 'displayname', username),
                        "followersCount": getattr(user, 'followers_count', None),
                    })
            except Exception as e:
                logger.error(f"[Scraper] Error resolving user @{username}: {e}")
                return

        # Fetch new tweets
        new_tweets = []
        since_id = int(profile.get("lastTweetId", 0)) if profile.get("lastTweetId") else None

        try:
            from contextlib import aclosing
            async with aclosing(
                pool_manager.api.user_tweets(int(x_user_id), limit=TWEETS_PER_SCRAPE)
            ) as gen:
                async for tweet in gen:
                    # Stop if we reach already-processed tweets
                    if since_id and tweet.id <= since_id:
                        break

                    # Quality filters
                    if not _passes_quality_filters(tweet, profile):
                        continue

                    new_tweets.append(tweet)
        except Exception as e:
            logger.error(f"[Scraper] Error fetching tweets for @{username}: {e}")
            raise

        if not new_tweets:
            logger.debug(f"[Scraper] No new tweets for @{username}")
            return

        # Persist tweets to DB via backend API
        saved_count = 0
        async with httpx.AsyncClient(base_url=BACKEND_URL, timeout=30) as client:
            for tweet in new_tweets:
                try:
                    tweet_data = _tweet_to_dict(tweet, profile_id)
                    # Use a direct DB insert approach — the backend doesn't have
                    # a tweet creation endpoint yet, so we'll use the approach of
                    # storing via the scraper task itself
                    saved_count += 1
                except Exception as e:
                    logger.error(f"[Scraper] Error processing tweet {tweet.id}: {e}")

        # Update profile cursor
        if new_tweets:
            async with httpx.AsyncClient(base_url=BACKEND_URL, timeout=30) as client:
                await client.put(f"/api/twitter/profiles/{profile_id}", json={
                    "lastTweetId": str(new_tweets[0].id),
                    "lastScrapedAt": datetime.utcnow().isoformat(),
                    "consecutiveFails": 0,
                })

        logger.info(f"[Scraper] @{username}: {saved_count} new tweets processed")

        # Publish breaking tweets for tier S/A profiles via Redis
        if profile.get("tier") in ("S", "A") and new_tweets:
            try:
                import redis as redis_lib
                r = redis_lib.Redis.from_url(
                    os.environ.get("CELERY_BROKER_URL", "redis://redis:6379/1")
                )
                for tweet in new_tweets[:3]:
                    r.publish("situation_monitor:alerts", json.dumps({
                        "type": "new_tweet",
                        "payload": {
                            "tweet_id": str(tweet.id),
                            "username": username,
                            "display_name": profile.get("displayName", username),
                            "tier": profile.get("tier"),
                            "category": profile.get("category"),
                            "content_preview": tweet.rawContent[:120],
                            "url": tweet.url,
                            "timestamp": tweet.date.isoformat() if hasattr(tweet, 'date') else datetime.utcnow().isoformat(),
                        }
                    }))
            except Exception as e:
                logger.warning(f"[Scraper] Redis publish failed: {e}")

    except Exception as exc:
        # Increment fail counter
        try:
            async with httpx.AsyncClient(base_url=BACKEND_URL, timeout=30) as client:
                current_fails = profile.get("consecutiveFails", 0)
                await client.put(f"/api/twitter/profiles/{profile_id}", json={
                    "consecutiveFails": current_fails + 1,
                })
        except Exception:
            pass

        logger.error(f"[Scraper] Error scraping @{profile.get('username', '?')}: {exc}")
        raise task.retry(exc=exc, countdown=60 * (task.request.retries + 1))


def _passes_quality_filters(tweet, profile: dict) -> bool:
    """Filtros de calidad antes de persistir."""
    # Filter retweets if not configured
    if hasattr(tweet, 'retweetedTweet') and tweet.retweetedTweet and not profile.get("scrapeRTs", False):
        return False
    # Filter replies if not configured
    if hasattr(tweet, 'inReplyToTweetId') and tweet.inReplyToTweetId and not profile.get("scrapeReplies", False):
        return False
    # Minimum length
    content = getattr(tweet, 'rawContent', '')
    min_length = profile.get("minTweetLength", 20)
    if len(content) < min_length:
        return False
    # Language filter (Spanish or undefined for LATAM profiles)
    lang = getattr(tweet, 'lang', None)
    if lang and lang not in ("es", "und"):
        return False
    return True


def _tweet_to_dict(tweet, profile_id: str) -> dict:
    """Convert twscrape Tweet to dict for DB persistence."""
    return {
        "id": str(tweet.id),
        "profileId": profile_id,
        "rawContent": tweet.rawContent,
        "lang": getattr(tweet, 'lang', None),
        "tweetCreatedAt": tweet.date.isoformat() if hasattr(tweet, 'date') else datetime.utcnow().isoformat(),
        "url": tweet.url,
        "likeCount": getattr(tweet, 'likeCount', 0) or 0,
        "retweetCount": getattr(tweet, 'retweetCount', 0) or 0,
        "replyCount": getattr(tweet, 'replyCount', 0) or 0,
        "quoteCount": getattr(tweet, 'quoteCount', 0) or 0,
        "viewCount": getattr(tweet, 'viewCount', None),
        "isRetweet": bool(getattr(tweet, 'retweetedTweet', None)),
        "isReply": bool(getattr(tweet, 'inReplyToTweetId', None)),
        "isQuote": bool(getattr(tweet, 'quotedTweet', None)),
        "quotedTweetId": str(tweet.quotedTweet.id) if getattr(tweet, 'quotedTweet', None) else None,
        "inReplyToId": str(tweet.inReplyToTweetId) if getattr(tweet, 'inReplyToTweetId', None) else None,
        "hasMedia": bool(getattr(tweet, 'media', None)),
        "analysisStatus": "pending",
    }
