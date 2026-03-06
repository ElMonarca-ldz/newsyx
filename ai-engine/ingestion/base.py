from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import AsyncIterator

@dataclass
class RawArticleRef:
    """Referencia a un artículo antes de ser procesado."""
    url: str
    titular: str
    fuente: str
    dominio: str
    fecha_publicacion: datetime | None
    descripcion_preview: str | None
    imagen_preview: str | None
    source_type: str  # "gnews" | "rss" | "newsapi" | "mediastack" | "direct_scrape"
    source_feed_id: str | None  # ID del feed/source que lo originó
    raw_metadata: dict  # Metadata original sin procesar de la fuente

class NewsSource(ABC):
    """Interfaz base para todas las fuentes de noticias."""
    
    source_type: str
    language: str = "es"
    
    @abstractmethod
    async def fetch_latest(self, limit: int = 50) -> AsyncIterator[RawArticleRef]:
        """Retorna artículos nuevos de esta fuente."""
        ...
    
    @abstractmethod
    async def health_check(self) -> bool:
        """Verifica que la fuente está disponible."""
        ...
