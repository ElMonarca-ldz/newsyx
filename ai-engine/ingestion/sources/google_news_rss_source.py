from ingestion.base import NewsSource, RawArticleRef
from ingestion.sources.google_news_utils import GoogleNews
from utils.domain_utils import get_base_domain
from typing import AsyncIterator
import asyncio
from datetime import datetime
import email.utils
import feedparser
import urllib.parse

class GoogleNewsRSSSource(NewsSource):
    """
    Google News RSS sin API key.
    Complementa GNews API con búsquedas más flexibles.
    """
    source_type = "google_news_rss"
    
    # Queries predefinidos para cobertura española
    DEFAULT_QUERIES = [
        "política españa",
        "economía europa",
        "tecnología inteligencia artificial",
        "clima medioambiente",
        "salud medicina",
        "internacional conflictos",
        "deportes liga",
        "cultura entretenimiento",
        "sociedad educación",
        "ciencia investigación"
    ]
    
    def __init__(self, country: str = "ES", language: str = "es"):
        self.gn = GoogleNews(country=country, lang=language)
    
    async def fetch_latest(self, limit: int = 100) -> AsyncIterator[RawArticleRef]:
        seen_urls = set()
        count = 0
        
        # Top news generales
        top = await asyncio.to_thread(self.gn.top_news)
        for entry in top.get("entries", []):
            if count >= limit:
                return
            url = entry.get("link", "")
            if url in seen_urls:
                continue
            seen_urls.add(url)
            count += 1
            yield self._parse_entry(entry, "google_rss_top")
        
        # Por queries temáticos
        for query in self.DEFAULT_QUERIES:
            if count >= limit:
                return
            results = await asyncio.to_thread(self.gn.search, query, when="1d")
            for entry in results.get("entries", []):
                if count >= limit:
                    return
                url = entry.get("link", "")
                if url in seen_urls:
                    continue
                seen_urls.add(url)
                count += 1
                yield self._parse_entry(entry, f"google_rss_query_{query[:15]}")
    
    def _parse_entry(self, entry: dict, feed_id: str) -> RawArticleRef:
        pub_date = None
        if entry.get("published"):
            try:
                pub_date = datetime(*email.utils.parsedate(entry["published"])[:6])
            except Exception:
                pass
        
        source_name = ""
        if entry.get("source"):
            source_name = entry["source"].get("title", "")
        
        return RawArticleRef(
            url=entry.get("link", ""),
            titular=entry.get("title", ""),
            fuente=source_name,
            dominio=get_base_domain(entry.get("source", {}).get("href", entry.get("link", ""))),
            fecha_publicacion=pub_date,
            descripcion_preview=entry.get("summary", ""),
            imagen_preview=None,
            source_type=self.source_type,
            source_feed_id=feed_id,
            raw_metadata=dict(entry)
        )
    
    async def health_check(self) -> bool:
        try:
            result = await asyncio.to_thread(self.gn.top_news)
            return len(result.get("entries", [])) > 0
        except Exception:
            return False
