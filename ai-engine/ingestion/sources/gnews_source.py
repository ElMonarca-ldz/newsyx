from ingestion.base import NewsSource, RawArticleRef
from ingestion.sources.google_news_utils import GoogleNews
from utils.domain_utils import get_base_domain
from typing import AsyncIterator
import asyncio
from datetime import datetime
import email.utils

class GNewsSource(NewsSource):
    """
    Google News via direct RSS implementation (replacing gnews library).
    Soporta búsqueda por query, topic y país.
    """
    source_type = "gnews"
    
    TOPICS_ES = [
        "WORLD", "NATION", "BUSINESS", "TECHNOLOGY",
        "ENTERTAINMENT", "SPORTS", "SCIENCE", "HEALTH"
    ]
    
    def __init__(self):
        self.client = GoogleNews(
            lang="es",
            country="ES"
        )
    
    async def fetch_latest(self, limit: int = 50) -> AsyncIterator[RawArticleRef]:
        """Itera sobre todos los topics y países configurados."""
        seen_urls = set()
        count = 0
        
        for topic in self.TOPICS_ES:
            if count >= limit:
                break
            result = await asyncio.to_thread(
                self.client.get_news_by_topic, topic
            )
            for entry in result.get("entries", []):
                url = entry.get("link", "")
                if url in seen_urls or not url:
                    continue
                seen_urls.add(url)
                count += 1
                
                pub_date = None
                if entry.get("published"):
                    try:
                        pub_date = datetime(*email.utils.parsedate(entry["published"])[:6])
                    except Exception:
                        pass

                yield RawArticleRef(
                    url=url,
                    titular=entry.get("title", ""),
                    fuente=entry.get("source", {}).get("title", ""),
                    dominio=get_base_domain(entry.get("source", {}).get("href", url)),
                    fecha_publicacion=pub_date,
                    descripcion_preview=entry.get("summary"),
                    imagen_preview=None, # RSS direct doesn't always provide image easily
                    source_type=self.source_type,
                    source_feed_id=f"gnews_topic_{topic}",
                    raw_metadata=dict(entry)
                )
    
    async def fetch_by_query(self, query: str, limit: int = 10) -> list[RawArticleRef]:
        """Búsqueda de noticias por query específico."""
        result = await asyncio.to_thread(self.client.search, query, when="1d")
        results = []
        for entry in result.get("entries", [])[:limit]:
            results.append(RawArticleRef(
                url=entry.get("link", ""),
                titular=entry.get("title", ""),
                fuente=entry.get("source", {}).get("title", ""),
                dominio=get_base_domain(entry.get("source", {}).get("href", entry.get("link", ""))),
                fecha_publicacion=None,
                descripcion_preview=entry.get("summary"),
                imagen_preview=None,
                source_type=self.source_type,
                source_feed_id=f"gnews_query_{query[:20]}",
                raw_metadata=dict(entry)
            ))
        return results
    
    async def health_check(self) -> bool:
        try:
            results = await asyncio.to_thread(self.client.top_news)
            return len(results.get("entries", [])) > 0
        except Exception:
            return False
