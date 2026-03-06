import newspaper
from newspaper import Source
from ingestion.base import NewsSource, RawArticleRef
from typing import AsyncIterator
import asyncio

# Medios configurados para scraping directo de portada
DIRECT_SCRAPE_SOURCES = {
    "elconfidencial_full":  "https://www.elconfidencial.com",
    "elespanol":            "https://www.elespanol.com",
    "vozpopuli":            "https://www.vozpopuli.com",
    "ctxt":                 "https://ctxt.es",
    "nuevatribuna":         "https://www.nuevatribuna.es",
    "periodistadigital":    "https://www.periodistadigital.com",
    "nius_diario":          "https://www.niusdiario.es",
    "elindependiente":      "https://www.elindependiente.com",
}

class DirectScrapeSource(NewsSource):
    """
    Scraping directo de portadas vía newspaper4k.
    Para medios sin RSS completo o con RSS limitado.
    """
    source_type = "direct_scrape"
    
    def __init__(self, source_id: str, url: str):
        self.source_id = source_id
        self.source_url = url
        self.newspaper_source: Source | None = None
    
    async def _build_source(self):
        if self.newspaper_source is None:
            config = newspaper.Config()
            config.browser_user_agent = (
                "Mozilla/5.0 (compatible; NewsAnalyzerBot/1.0)"
            )
            config.request_timeout = 15
            config.language = "es"
            self.newspaper_source = newspaper.build(
                self.source_url, config=config, memoize_articles=False
            )
    
    async def fetch_latest(self, limit: int = 20) -> AsyncIterator[RawArticleRef]:
        await asyncio.to_thread(self._build_source_sync)
        
        if not self.newspaper_source:
             return

        for article in list(self.newspaper_source.articles)[:limit]:
            if not article.url:
                continue
            yield RawArticleRef(
                url=article.url,
                titular=article.title or "",
                fuente=self.source_id,
                dominio=self.source_url.split("/")[2],
                fecha_publicacion=article.publish_date,
                descripcion_preview=None,
                imagen_preview=article.top_image,
                source_type=self.source_type,
                source_feed_id=self.source_id,
                raw_metadata={"meta_keywords": article.meta_keywords}
            )
    
    def _build_source_sync(self):
        config = newspaper.Config()
        config.language = "es"
        config.request_timeout = 15
        self.newspaper_source = newspaper.build(
            self.source_url, config=config, memoize_articles=False
        )
    
    async def health_check(self) -> bool:
        try:
            await asyncio.to_thread(self._build_source_sync)
            return self.newspaper_source is not None and len(self.newspaper_source.articles) > 0
        except Exception:
            return False
