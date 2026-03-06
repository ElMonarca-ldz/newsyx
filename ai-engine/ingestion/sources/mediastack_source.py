import httpx
from ingestion.base import NewsSource, RawArticleRef
from utils.domain_utils import get_base_domain
from typing import AsyncIterator
import os
from datetime import datetime

class MediastackSource(NewsSource):
    """
    Mediastack API — buena cobertura de medios latinoamericanos.
    Usar como fuente complementaria y de backup.
    """
    source_type = "mediastack"
    BASE_URL = "http://api.mediastack.com/v1"
    
    def __init__(self):
        self.api_key = os.environ.get("MEDIASTACK_API_KEY")
    
    async def fetch_latest(self, limit: int = 50) -> AsyncIterator[RawArticleRef]:
        if not self.api_key:
            return

        params = {
            "access_key": self.api_key,
            "languages": "es",
            "sort": "published_desc",
            "limit": min(limit, 100),
            "countries": "es,mx,ar,co,cl,pe,ve,uy,bo,ec,py,do,cr,gt,hn,sv,ni,pa,cu,pr"
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(f"{self.BASE_URL}/news", params=params)
                # Check metrics before raising? Mediastack might return error in JSON
                if response.status_code != 200:
                    return

                data = response.json()
            
            for article in data.get("data", []):
                url = article.get("url", "")
                if not url:
                    continue
                
                pub_date = None
                if article.get("published_at"):
                    pub_date = datetime.fromisoformat(
                        article["published_at"].replace("Z", "+00:00")
                    )
                
                yield RawArticleRef(
                    url=url,
                    titular=article.get("title", ""),
                    fuente=article.get("source", ""),
                    dominio=get_base_domain(url),
                    fecha_publicacion=pub_date,
                    descripcion_preview=article.get("description"),
                    imagen_preview=article.get("image"),
                    source_type=self.source_type,
                    source_feed_id="mediastack_es",
                    raw_metadata={
                        "author": article.get("author"),
                        "category": article.get("category"),
                        "country": article.get("country"),
                        "language": article.get("language")
                    }
                )
        except Exception as e:
            print(f"Error fetching from Mediastack: {e}")
    
    async def health_check(self) -> bool:
        if not self.api_key:
            return False
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(
                    f"{self.BASE_URL}/news",
                    params={"access_key": self.api_key, "languages": "es", "limit": 1}
                )
                return r.status_code == 200
        except Exception:
            return False
