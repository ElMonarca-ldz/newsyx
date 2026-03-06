from newsapi import NewsApiClient
from ingestion.base import NewsSource, RawArticleRef
from utils.domain_utils import get_base_domain
from typing import AsyncIterator
import asyncio
import os
from datetime import datetime, timedelta

class NewsAPISource(NewsSource):
    """
    NewsAPI.org — cobertura amplia de medios hispanohablantes.
    Complementa los RSS con capacidad de búsqueda por keyword.
    """
    source_type = "newsapi"
    
    # Dominios hispanohablantes configurados en NewsAPI
    SOURCES_ES = [
        "el-mundo", "la-vanguardia", "the-huffington-post",
        "google-news-ar", "google-news-es", "google-news-mx"
    ]
    
    def __init__(self):
        # Fail gracefully if key is missing, although it should be there
        api_key = os.environ.get("NEWSAPI_KEY")
        self.client = NewsApiClient(api_key=api_key) if api_key else None
    
    async def fetch_latest(self, limit: int = 100) -> AsyncIterator[RawArticleRef]:
        if not self.client:
            return

        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        
        try:
            response = await asyncio.to_thread(
                self.client.get_everything,
                language="es",
                sort_by="publishedAt",
                from_param=yesterday,
                page_size=min(limit, 100)
            )
            
            for article in response.get("articles", []):
                url = article.get("url", "")
                if not url or url == "[Removed]":
                    continue
                
                pub_date = None
                if article.get("publishedAt"):
                    pub_date = datetime.fromisoformat(
                        article["publishedAt"].replace("Z", "+00:00")
                    )
                
                yield RawArticleRef(
                    url=url,
                    titular=article.get("title", ""),
                    fuente=article.get("source", {}).get("name", ""),
                    dominio=get_base_domain(url),
                    fecha_publicacion=pub_date,
                    descripcion_preview=article.get("description"),
                    imagen_preview=article.get("urlToImage"),
                    source_type=self.source_type,
                    source_feed_id="newsapi_es_latest",
                    raw_metadata={
                        "author": article.get("author"),
                        "content_preview": article.get("content", "")[:200]
                    }
                )
        except Exception as e:
            # Logger should be used here, print for now
            print(f"Error fetching from NewsAPI: {e}")
    
    async def search(self, query: str, days_back: int = 7) -> list[RawArticleRef]:
        """Búsqueda histórica por keyword."""
        if not self.client:
            return []

        from_date = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")
        
        try:
            response = await asyncio.to_thread(
                self.client.get_everything,
                q=query,
                language="es",
                sort_by="relevancy",
                from_param=from_date,
                page_size=20
            )
            
            results = []
            for article in response.get("articles", []):
                url = article.get("url", "")
                if not url or url == "[Removed]":
                    continue
                results.append(RawArticleRef(
                    url=url,
                    titular=article.get("title", ""),
                    fuente=article.get("source", {}).get("name", ""),
                    dominio=get_base_domain(url),
                    fecha_publicacion=None,
                    descripcion_preview=article.get("description"),
                    imagen_preview=article.get("urlToImage"),
                    source_type=self.source_type,
                    source_feed_id=f"newsapi_search_{query[:20]}",
                    raw_metadata=article
                ))
            return results
        except Exception as e:
            print(f"Error searching NewsAPI: {e}")
            return []
    
    async def health_check(self) -> bool:
        if not self.client:
            return False
        try:
            r = await asyncio.to_thread(self.client.get_sources, language="es")
            return r.get("status") == "ok"
        except Exception:
            return False
