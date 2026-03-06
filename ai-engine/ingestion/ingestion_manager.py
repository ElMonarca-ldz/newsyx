import asyncio
import hashlib
from datetime import datetime
from typing import List
from ingestion.base import RawArticleRef
from ingestion.sources.gnews_source import GNewsSource
from ingestion.sources.rss_source import RSSSource, DEFAULT_RSS_FEEDS
from ingestion.sources.newsapi_source import NewsAPISource
from ingestion.sources.mediastack_source import MediastackSource
from database.postgres import get_db_session
from utils.domain_utils import get_base_domain
import logging
import os
import uuid
from urllib.parse import urlparse, urlunparse

logger = logging.getLogger(__name__)

class IngestionManager:
    """
    Gestiona todas las fuentes de ingesta y coordina la deduplicación.
    Se ejecuta periódicamente via Celery Beat.
    """
    
    def __init__(self):
        # Fuentes estáticas (APIs con keys)
        self.static_sources = self._build_static_sources()
    
    def _build_static_sources(self) -> list:
        sources = []
        
        # Google News API (si hay key configurada)
        if os.environ.get("GNEWS_API_KEY") and os.environ.get("ENABLE_GNEWS") == "true":
            sources.append(GNewsSource())
        
        # NOTE: GoogleNewsRSSSource was removed. It fetched from ANY domain on the
        # internet bypassing the whitelist. Only DB-registered, active sources are now used.
        
        # NewsAPI (si hay key)
        if os.environ.get("NEWSAPI_KEY") and os.environ.get("ENABLE_NEWSAPI") == "true":
            sources.append(NewsAPISource())
        
        # Mediastack (si hay key)
        if os.environ.get("MEDIASTACK_API_KEY") and os.environ.get("ENABLE_MEDIASTACK") == "true":
            sources.append(MediastackSource())
        
        return sources

    async def _load_active_rss_sources(self) -> list:
        """Carga los feeds RSS marcados como activos en la base de datos."""
        sources = []
        try:
            async with get_db_session() as db:
                rows = await db.fetch(
                    "SELECT feed_id, url, nombre FROM rss_feeds WHERE activo = true"
                )
                for row in rows:
                    sources.append(RSSSource(
                        feed_id=row["feed_id"],
                        feed_url=row["url"],
                        fuente_nombre=row["nombre"]
                    ))
            logger.info(f"Loaded {len(sources)} active RSS sources from DB")
        except Exception as e:
            logger.error(f"Failed to load active RSS sources: {e}")
            # Fallback a defaults si la DB falla y estamos en modo emergencia
            for feed_id, feed_url in DEFAULT_RSS_FEEDS.items():
                nombre = feed_id.replace("_", " ").replace("portada", "").title().strip()
                sources.append(RSSSource(feed_id, feed_url, nombre))
        return sources

    async def _get_source_statuses(self) -> dict:
        """Obtiene el estado 'activo' de todos los dominios registrados."""
        try:
            async with get_db_session() as db:
                rows = await db.fetch(
                    "SELECT dominio, activo FROM rss_feeds"
                )
                # Creamos un mapa: {dominio_normalizado: activo_bool}
                return {get_base_domain(row["dominio"]): row["activo"] for row in rows}
        except Exception as e:
            logger.error(f"Failed to load source statuses: {e}")
            return {}

    async def _register_discovered_source(self, domain: str, name_fallback: str = "Discovered Source"):
        """Registra un nuevo dominio en la base de datos (desactivado por defecto)."""
        try:
            async with get_db_session() as db:
                # Verificar si ya existe por si acaso (race condition)
                exists = await db.fetchval(
                    "SELECT 1 FROM rss_feeds WHERE dominio = $1 OR dominio = $2",
                    domain, f"www.{domain}"
                )
                if exists:
                    return

                new_id = str(uuid.uuid4())
                await db.execute(
                    """
                    INSERT INTO rss_feeds (id, feed_id, url, nombre, dominio, activo, es_default, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
                    """,
                    new_id,
                    f"discovered_{domain.replace('.', '_')}",
                    f"https://{domain}", # URL placeholder
                    name_fallback,
                    domain,
                    False, # DEFAUL INACTIVE
                    False
                )
                logger.info(f"Auto-registered new source in DB (INACTIVE): {domain}")
        except Exception as e:
            logger.error(f"Failed to auto-register source {domain}: {e}")
    
    @staticmethod
    def compute_url_hash(url: str) -> str:
        """SHA-256 de la URL normalizada para deduplicación (remueve parámetros)."""
        # Normalizar: remover query y fragment, lowercase
        parsed = urlparse(url)
        normalized_url = urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, '', ''))
        normalized_url = normalized_url.lower().strip().rstrip("/")
        return hashlib.sha256(normalized_url.encode()).hexdigest()

    @staticmethod
    def compute_title_hash(title: str) -> str:
        """MD5 del título normalizado."""
        import re
        import unicodedata
        if not title:
            return ""
        normalized = unicodedata.normalize('NFKD', title).encode('ascii', 'ignore').decode('ascii')
        normalized = re.sub(r'[^\w\s]', '', normalized).lower()
        normalized = re.sub(r'\s+', ' ', normalized).strip()
        return hashlib.md5(normalized.encode("utf-8")).hexdigest()
    
    async def run_ingestion_cycle(self) -> dict:
        """
        Ciclo completo de ingesta:
        1. Cargar fuentes activas y dominios bloqueados
        2. Fetch desde todas las fuentes en paralelo
        3. Filtrar por dominio bloqueado
        4. Deduplicar contra BD
        5. Encolar artículos nuevos para análisis
        """
        # 1. Carga de configuraciones dinámicas
        async with get_db_session() as db:
            ingestion_cycle_minutes = await db.fetchval("SELECT value FROM system_configs WHERE key = 'INGESTION_CYCLE_MINUTES'")
            last_run = await db.fetchval("SELECT value FROM system_configs WHERE key = 'LAST_INGESTION_TIMESTAMP'")
            max_articles = await db.fetchval("SELECT value FROM system_configs WHERE key = 'MAX_ARTICLES_PER_CYCLE'")
        
        # Valores por defecto si no existen en DB
        ingestion_cycle_minutes = int(ingestion_cycle_minutes) if ingestion_cycle_minutes else 15
        max_articles = int(max_articles) if max_articles else 200
        
        # Verificar si corresponde ejecutar (throttle)
        now = datetime.utcnow()
        if last_run:
            last_run_dt = datetime.fromisoformat(last_run)
            from datetime import timedelta
            if now < last_run_dt + timedelta(minutes=ingestion_cycle_minutes):
                logger.info(f"Skipping cycle: Next run in {((last_run_dt + timedelta(minutes=ingestion_cycle_minutes)) - now).total_seconds() / 60:.1f} minutes")
                return {"status": "skipped", "reason": "throttled"}

        # Actualizar timestamp de última ejecución
        async with get_db_session() as db:
            await db.execute(
                "INSERT INTO system_configs (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) "
                "ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP",
                'LAST_INGESTION_TIMESTAMP', now.isoformat()
            )

        active_rss = await self._load_active_rss_sources()
        source_statuses = await self._get_source_statuses() # {dominio: activo}
        all_sources = active_rss  # Only use explicitly active sources from DB

        all_refs: List[RawArticleRef] = []
        
        # 2. Fetch en paralelo desde todas las fuentes
        tasks = [self._safe_fetch(source, limit=max_articles) for source in all_sources]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Flatten results (handling potential exceptions from gather)
        for res in results:
            if isinstance(res, list):
                all_refs.extend(res)
            elif isinstance(res, Exception):
                logger.error(f"Fetch task failed during gather: {res}")
        
        # 2.5 Temporal Filter: Discard articles older than 7 days or too far in the future
        from datetime import timedelta
        now_utc = datetime.utcnow()
        cutoff_past = now_utc - timedelta(days=7)
        cutoff_future = now_utc + timedelta(days=1) # 1 day margin for TZ issues
        original_count = len(all_refs)
        
        # Filter refs that have a publication date and are within the window
        # STALENESS RULE: If fecha_publicacion is None, we discard it to be safe 
        valid_refs = []
        discarded_count = 0
        
        for ref in all_refs:
            if ref.fecha_publicacion is None:
                logger.debug(f"Discarding article (no date): {ref.titular}")
                discarded_count += 1
                continue
            
            # Use a strict window to avoid old news or future-dated errors
            if ref.fecha_publicacion < cutoff_past or ref.fecha_publicacion > cutoff_future:
                logger.info(f"Discarding article (outside 7d window): [{ref.fecha_publicacion}] {ref.titular}")
                discarded_count += 1
                continue
                
            valid_refs.append(ref)
            
        all_refs = valid_refs
        
        if discarded_count > 0:
            logger.info(f"Temporal filter: Discarded {discarded_count} articles (outside window or missing date)")

        # 3. STRICT WHITELIST FILTER
        # An article ONLY proceeds if its domain is EXPLICITLY in rss_feeds with activo = true.
        # Unknown domains are auto-registered as INACTIVE (visible in Fuentes) but produce NO articles.
        logger.info(f"Applying STRICT whitelist filter. Known active sources: {sum(1 for v in source_statuses.values() if v)}")
        filtered_refs = []
        discovered_this_cycle = set()

        for ref in all_refs:
            domain = get_base_domain(ref.dominio)
            
            if domain in source_statuses:
                if source_statuses[domain]:
                    # Domain is known AND active → allow
                    filtered_refs.append(ref)
                else:
                    # Domain is known but INACTIVE → reject
                    logger.debug(f"Source inactive, skipping: {domain}")
            else:
                # Domain is UNKNOWN → auto-register as INACTIVE, never allow this cycle
                if domain not in discovered_this_cycle:
                    logger.info(f"New source discovered: '{domain}'. Auto-registering as INACTIVE. Activate it from the Sources section.")
                    await self._register_discovered_source(domain, ref.fuente or domain)
                    discovered_this_cycle.add(domain)
                    source_statuses[domain] = False  # Mark as inactive for rest of this cycle
                logger.debug(f"Blocked article from UNKNOWN source (not yet authorized): {domain}")

        # 4. Deduplicar por URL hash en memoria
        seen_hashes = set()
        unique_refs = []
        for ref in filtered_refs:
            h = self.compute_url_hash(ref.url)
            if h not in seen_hashes:
                seen_hashes.add(h)
                unique_refs.append(ref)
        
        # 5. Filtrar URLs ya existentes en PostgreSQL
        new_refs = await self._filter_already_processed(unique_refs)
        
        # 6. Encolar para análisis
        enqueued = 0
        from tasks.celery_tasks import analyze_article_task
        for ref in new_refs:
            analyze_article_task.apply_async(
                args=[ref.url, ref.__dict__],
                queue="default"
            )
            enqueued += 1
        
        logger.info(f"Ingestion cycle: {len(all_refs)} fetched, "
                   f"{len(filtered_refs)} after domain filter, "
                   f"{len(new_refs)} new, {enqueued} enqueued")
        
        return {
            "total_fetched": len(all_refs),
            "filtered_by_domain": len(all_refs) - len(filtered_refs),
            "new": len(new_refs),
            "enqueued": enqueued,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    async def _safe_fetch(self, source, limit: int = 50) -> list:
        """Fetch con manejo de errores para que un fallo no bloquee las demás."""
        try:
            refs = []
            async for ref in source.fetch_latest(limit=limit):
                refs.append(ref)
            return refs
        except Exception as e:
            logger.error(f"Source {source.source_type} failed: {e}")
            return []
    
    async def _filter_already_processed(
        self, refs: List[RawArticleRef]
    ) -> List[RawArticleRef]:
        """Consulta PostgreSQL para filtrar URLs y Títulos ya procesados."""
        if not refs:
            return []
        
        url_hashes = [self.compute_url_hash(r.url) for r in refs]
        # titular might be empty if raw source misses it, so fallback to ""
        title_hashes = [self.compute_title_hash(getattr(r, "titular", "") or getattr(r, "title", "") or "") for r in refs]
        
        async with get_db_session() as db:
            # First query: Existing URLs
            existing_urls = await db.fetch(
                "SELECT url_hash FROM news_analysis WHERE url_hash = ANY($1)",
                url_hashes
            )
            existing_url_set = {row["url_hash"] for row in existing_urls}

            # Second query: Existing Titles (ignore empty hashes)
            valid_title_hashes = [h for h in title_hashes if h]
            existing_title_set = set()
            if valid_title_hashes:
                existing_titles = await db.fetch(
                    "SELECT title_hash FROM news_analysis WHERE title_hash = ANY($1)",
                    valid_title_hashes
                )
                existing_title_set = {row["title_hash"] for row in existing_titles if row["title_hash"]}
        
        # Keep refs that have neither seen URL nor seen title
        filtered_refs = []
        for ref, uh, th in zip(refs, url_hashes, title_hashes):
            if uh in existing_url_set:
                logger.info(f"Discarding duplicate by URL hash: {ref.url}")
                continue
            if th and th in existing_title_set:
                logger.info(f"Discarding duplicate by Title hash: {getattr(ref, 'titular', '')}")
                continue
            filtered_refs.append(ref)
            
        return filtered_refs
