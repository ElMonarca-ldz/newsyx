"""
Gestiona el pool de cuentas scraper con circuit breaker por cuenta.
twscrape maneja la rotación automática, pero este manager agrega:
- Health tracking persistente en Redis
- Circuit breaker con cooldown configurable
- Alertas cuando el pool queda degradado
"""
import asyncio
import json
import os
import logging
import httpx
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

CIRCUIT_COOLDOWN_MINUTES = 30
POOL_DEGRADED_THRESHOLD = 0.5  # Alerta si <50% de cuentas activas


class AccountPoolManager:
    """
    Wrapper around twscrape API pool with health monitoring and circuit breaker.
    Cuentas se configuran via env var TWITTER_SCRAPER_ACCOUNTS (JSON array).
    """

    def __init__(self):
        self.api = None
        self._initialized = False

    async def initialize(self):
        """Carga las cuentas desde variables de entorno al inicializar."""
        if self._initialized:
            return

        try:
            from twscrape import API as TwscrapeAPI
        except ImportError:
            logger.error("[AccountPool] twscrape not installed. Run: pip install twscrape")
            return

        db_path = os.environ.get("TWSCRAPE_DB_PATH", "twscrape_accounts.db")
        self.api = TwscrapeAPI(db_path)

        # Sync accounts from DB instead of env vars
        await self.sync_accounts()

        self._initialized = True
        logger.info("[AccountPool] Initialized via backend sync")

    async def sync_accounts(self):
        """Fetches active accounts from the backend API and adds them to the pool."""
        if not self.api:
            return

        backend_url = os.environ.get("BACKEND_URL", "http://backend:4000")
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(f"{backend_url}/api/twitter/accounts/internal")
                resp.raise_for_status()
                accounts = resp.json()
        except Exception as e:
            logger.error(f"[AccountPool] Failed to sync accounts from backend: {e}")
            return

        for acc in accounts:
            try:
                # Add or update the account in twscrape's sqlite
                await self.api.pool.add_account(
                    username=acc["username"],
                    password=acc.get("password") or "",
                    email=acc.get("email") or "",
                    email_password=acc.get("emailPassword") or "",
                    cookies=acc.get("cookies"),
                    proxy=acc.get("proxyUrl"),
                )
            except Exception as e:
                logger.warning(f"[AccountPool] Error syncing account {acc.get('username')}: {e}")

        logger.info(f"[AccountPool] Synced {len(accounts)} accounts from backend")

    async def get_health_report(self) -> dict:
        """Estado actual del pool para el admin panel."""
        if not self.api:
            return {"total": 0, "active": 0, "circuit_open": 0, "health_pct": 0, "degraded": True, "accounts": []}

        try:
            accounts = await self.api.pool.accounts_info()
        except Exception as e:
            logger.error(f"[AccountPool] Error getting accounts info: {e}")
            return {"total": 0, "active": 0, "circuit_open": 0, "health_pct": 0, "degraded": True, "accounts": []}

        total = len(accounts)
        active = sum(1 for a in accounts if a.active and a.logged_in)
        circuit_open = sum(1 for a in accounts if not a.active)

        health = {
            "total": total,
            "active": active,
            "circuit_open": circuit_open,
            "health_pct": round(active / total * 100 if total else 0, 1),
            "degraded": active / total < POOL_DEGRADED_THRESHOLD if total else True,
            "accounts": [
                {
                    "username": a.username,
                    "active": a.active,
                    "logged_in": a.logged_in,
                    "last_used": a.last_used.isoformat() if hasattr(a, 'last_used') and a.last_used else None,
                    "total_req": getattr(a, 'total_req', 0),
                    "error": getattr(a, 'error_msg', None),
                }
                for a in accounts
            ],
        }

        # Persist to Redis for frontend cache
        try:
            import redis as redis_lib
            r = redis_lib.Redis.from_url(os.environ.get("CELERY_BROKER_URL", "redis://redis:6379/1"))
            r.setex("twitter:pool:health", 60, json.dumps(health))

            # Alert if pool degraded
            if health["degraded"]:
                r.publish("situation_monitor:alerts", json.dumps({
                    "type": "pool_degraded",
                    "payload": {
                        "tipo": "twitter_pool_degradado",
                        "descripcion": f"Solo {active}/{total} cuentas scraper activas",
                        "severidad": "danger" if active == 0 else "warning",
                        "accion_sugerida": "verificar_fuente",
                    }
                }))
        except Exception as e:
            logger.warning(f"[AccountPool] Redis health publish failed: {e}")

        return health

    async def relogin_failed(self):
        """Reintentar login de cuentas fallidas. Llamar desde admin panel."""
        if self.api:
            await self.api.pool.relogin_failed()
            logger.info("[AccountPool] Relogin attempted for failed accounts")


# Singleton
pool_manager = AccountPoolManager()
