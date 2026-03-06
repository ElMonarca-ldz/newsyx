# Newsyx — Prompt Completo para Agente de Desarrollo
### Versión 2.0 | PostgreSQL | OpenRouter + Gemini Flash 2.5 | Noticias en Español

> **Instrucciones de uso:** Copia este documento completo como prompt de sistema a tu agente de IA (Antigravity). El agente construirá la aplicación completa siguiendo el orden de implementación especificado. No omitas ninguna sección.

---

## 🎯 CONTEXTO Y OBJETIVO

Eres un agente de desarrollo de software experto en Python, Node.js, React y arquitecturas de IA. Tu tarea es construir **Newsyx**, una plataforma completa de análisis periodístico automatizado con inteligencia artificial, especializada en **noticias en español**.

El sistema ingesta noticias desde múltiples fuentes (Google News, RSS feeds, APIs de noticias, scraping directo de medios), las procesa a través de un pipeline multicapa de NLP e IA, y produce un JSON estructurado con más de 60 campos de análisis cubriendo contenido, lingüística, framing editorial, sesgo político, calidad periodística, comparativa cross-media y scoring de credibilidad.

Debes crear **todos los archivos, configuraciones, código y tests** necesarios para que el sistema funcione end-to-end. No dejes placeholders ni TODOs sin implementar.

---

## 🛠️ STACK TECNOLÓGICO

### Frontend
- **React 18** + **TypeScript** (strict mode)
- **Vite** como bundler
- **Tailwind CSS v3** para estilos (dark mode por defecto)
- **shadcn/ui** para componentes base
- **TanStack Query v5** para data fetching y caché
- **Zustand** para estado global
- **React Router v6** para navegación
- **Recharts** para visualizaciones
- **React Hook Form + Zod** para formularios

### Backend API Gateway
- **Node.js 20+** + **Express** + **TypeScript** (strict)
- **Prisma ORM** para PostgreSQL (con tipado automático generado)
- **Zod** para validación de schemas de entrada
- **jsonwebtoken** para autenticación JWT
- **ioredis** para caché
- **axios** para comunicación con el AI Engine
- **express-rate-limit** para throttling

### AI Engine
- **Python 3.11+** + **FastAPI** + **uvicorn**
- **Celery** con Redis como broker para tareas asíncronas
- **LangGraph** para el agente orquestador
- **OpenRouter API** como gateway LLM → modelo: `google/gemini-flash-2.5`
- **trafilatura** para extracción de texto web
- **playwright** (Python) para páginas con renderizado JS
- **spaCy** con modelo `es_core_news_lg` (español grande)
- **pysentimiento** para sentimiento y emociones en español
- **KeyBERT** + `paraphrase-multilingual-MiniLM-L12-v2` para keywords
- **sentence-transformers** para embeddings semánticos
- **Pydantic v2** para schemas y validación

### Ingesta de Noticias
- **GNews API** — Google News programático con filtro por idioma español
- **feedparser** — RSS/Atom feeds de medios hispanohablantes
- **NewsAPI.org** — Agregador con cobertura de medios en español
- **mediastack** — API alternativa con sources en español
- **pygooglenews** — Wrapper no oficial de Google News RSS
- **newspaper4k** — Scraping directo de portadas de medios

### Base de Datos
- **PostgreSQL 16** con columnas tipadas + **JSONB** para datos analíticos
- **Prisma ORM** para gestión de schema y migraciones
- **Redis 7** para colas Celery y caché de resultados

### Infraestructura
- **Docker Compose** para orquestación local completa
- **GitHub Actions** para CI

---

## 📰 MÓDULO DE INGESTA — FUENTES Y ESTRATEGIA

Este es el módulo de entrada del sistema. Implementa todas las fuentes descritas con un diseño unificado de interfaz.

### Arquitectura de Ingesta

Todas las fuentes implementan la misma interfaz base:

```python
# ai-engine/ingestion/base.py

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
```

---

### FUENTE 1 — Google News vía GNews API

**Librería:** `gnews==0.3.7` (wrapper oficial de GNews API)  
**Documentación:** https://gnews.io  
**Plan gratuito:** 100 requests/día, hasta 10 artículos por request  
**Variable de entorno:** `GNEWS_API_KEY`

```python
# ai-engine/ingestion/sources/gnews_source.py

import gnews
from ingestion.base import NewsSource, RawArticleRef
from typing import AsyncIterator
import asyncio
from datetime import datetime

class GNewsSource(NewsSource):
    """
    Google News via GNews API.
    Soporta búsqueda por query, topic y país.
    """
    source_type = "gnews"
    
    TOPICS_ES = [
        "WORLD", "NATION", "BUSINESS", "TECHNOLOGY",
        "ENTERTAINMENT", "SPORTS", "SCIENCE", "HEALTH"
    ]
    
    # Países hispanohablantes para diversificar cobertura
    COUNTRIES = ["es", "mx", "ar", "co", "cl", "pe", "ve"]
    
    def __init__(self):
        self.client = gnews.GNews(
            language="es",
            country="ES",
            max_results=10,
            period="1d"   # últimas 24h
        )
    
    async def fetch_latest(self, limit: int = 50) -> AsyncIterator[RawArticleRef]:
        """Itera sobre todos los topics y países configurados."""
        seen_urls = set()
        count = 0
        
        for topic in self.TOPICS_ES:
            if count >= limit:
                break
            articles = await asyncio.to_thread(
                self.client.get_news_by_topic, topic
            )
            for article in articles:
                url = article.get("url", "")
                if url in seen_urls or not url:
                    continue
                seen_urls.add(url)
                count += 1
                yield RawArticleRef(
                    url=url,
                    titular=article.get("title", ""),
                    fuente=article.get("publisher", {}).get("title", ""),
                    dominio=article.get("publisher", {}).get("href", ""),
                    fecha_publicacion=datetime.fromisoformat(
                        article["published date"].replace("Z", "+00:00")
                    ) if article.get("published date") else None,
                    descripcion_preview=article.get("description"),
                    imagen_preview=article.get("image"),
                    source_type=self.source_type,
                    source_feed_id=f"gnews_topic_{topic}",
                    raw_metadata=article
                )
    
    async def fetch_by_query(self, query: str, limit: int = 10) -> list[RawArticleRef]:
        """Búsqueda de noticias por query específico."""
        articles = await asyncio.to_thread(self.client.get_news, query)
        results = []
        for article in articles[:limit]:
            results.append(RawArticleRef(
                url=article.get("url", ""),
                titular=article.get("title", ""),
                fuente=article.get("publisher", {}).get("title", ""),
                dominio=article.get("publisher", {}).get("href", ""),
                fecha_publicacion=None,
                descripcion_preview=article.get("description"),
                imagen_preview=None,
                source_type=self.source_type,
                source_feed_id=f"gnews_query_{query[:20]}",
                raw_metadata=article
            ))
        return results
    
    async def health_check(self) -> bool:
        try:
            results = await asyncio.to_thread(self.client.get_top_news)
            return len(results) > 0
        except Exception:
            return False
```

---

### FUENTE 2 — Google News RSS vía pygooglenews

**Librería:** `pygooglenews==0.1.2`  
**Sin API key requerida** (usa el RSS público de Google News)  
**Ideal para:** búsquedas por query y seguimiento de temas en tiempo real

```python
# ai-engine/ingestion/sources/google_news_rss_source.py

from pygooglenews import GoogleNews
from ingestion.base import NewsSource, RawArticleRef
from typing import AsyncIterator
import asyncio
from datetime import datetime
import email.utils

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
            dominio=entry.get("source", {}).get("href", ""),
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
```

---

### FUENTE 3 — RSS Feeds de Medios Hispanohablantes

**Librería:** `feedparser==6.0.11`  
**Sin API key requerida**  
**Ideal para:** cobertura directa de los medios más importantes, sin intermediarios

Implementa un sistema de gestión de feeds configurable desde la base de datos. Los feeds se almacenan en la tabla `rss_feeds` de PostgreSQL y el sistema los consulta periódicamente con Celery Beat.

```python
# ai-engine/ingestion/sources/rss_source.py

import feedparser
import asyncio
from datetime import datetime
from ingestion.base import NewsSource, RawArticleRef
from typing import AsyncIterator

# ─── CATÁLOGO INICIAL DE FEEDS RSS ────────────────────────────────────────────
# Estos feeds se cargan en la BD en el seed inicial.
# El usuario puede añadir/quitar feeds desde la UI.

DEFAULT_RSS_FEEDS = {
    # ── España ──
    "elpais_portada":         "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada",
    "elpais_economia":        "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/economia/portada",
    "elpais_politica":        "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/espana/portada",
    "elpais_tecnologia":      "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/tecnologia/portada",
    "elmundo_portada":        "https://www.elmundo.es/rss/portada.xml",
    "elmundo_economia":       "https://www.elmundo.es/rss/economia.xml",
    "elmundo_espana":         "https://www.elmundo.es/rss/espana.xml",
    "abc_portada":            "https://www.abc.es/rss/feeds/abc_espana.xml",
    "abc_economia":           "https://www.abc.es/rss/feeds/abc_economia.xml",
    "lavanguardia_portada":   "https://www.lavanguardia.com/rss/home.xml",
    "lavanguardia_economia":  "https://www.lavanguardia.com/rss/economia.xml",
    "20minutos":              "https://www.20minutos.es/rss/",
    "elconfidencial":         "https://feeds.elconfidencial.com/espana",
    "eldiario":               "https://www.eldiario.es/rss/",
    "publico":                "https://www.publico.es/rss",
    "okdiario":               "https://okdiario.com/feed",
    "infolibre":              "https://www.infolibre.es/rss",
    "expansion_portada":      "https://e00-expansion.uecdn.es/rss/portada.xml",
    "cincodias":              "https://cincodias.elpais.com/rss/cincodias/portada",
    "eleconomista":           "https://feeds.eleconomista.es/economia-rss",
    
    # ── México ──
    "jornada_mx":             "https://www.jornada.com.mx/rss/politics.xml",
    "reforma_mx":             "https://www.reforma.com/rss/portada.xml",
    "proceso_mx":             "https://www.proceso.com.mx/rss/feed.rss",
    "milenio_mx":             "https://www.milenio.com/rss",
    "animal_politico":        "https://www.animalpolitico.com/feed",
    
    # ── Argentina ──
    "clarin_ar":              "https://www.clarin.com/rss/lo-ultimo/",
    "lanacion_ar":            "https://www.lanacion.com.ar/arc/outboundfeeds/rss/",
    "infobae_ar":             "https://www.infobae.com/feeds/rss/",
    "pagina12_ar":            "https://www.pagina12.com.ar/rss/portada",
    
    # ── Colombia ──
    "eltiempo_co":            "https://www.eltiempo.com/rss/portada.xml",
    "semana_co":              "https://feeds.feedburner.com/SemanaRss",
    
    # ── Internacional en español ──
    "bbc_mundo":              "https://feeds.bbci.co.uk/mundo/rss.xml",
    "rt_espanol":             "https://actualidad.rt.com/rss",
    "dw_espanol":             "https://rss.dw.com/rdf/rss-es-all",
    "france24_es":            "https://www.france24.com/es/rss",
    "euronews_es":            "https://es.euronews.com/rss",
    "ap_espanol":             "https://rsshub.app/apnews/topics/noticias-en-espanol",
    "reuters_es":             "https://feeds.reuters.com/reuters/MXTopNews",
}

class RSSSource(NewsSource):
    """
    Lector de RSS/Atom feeds.
    Cada instancia gestiona un feed individual.
    """
    source_type = "rss"
    
    def __init__(self, feed_id: str, feed_url: str, fuente_nombre: str):
        self.feed_id = feed_id
        self.feed_url = feed_url
        self.fuente_nombre = fuente_nombre
    
    async def fetch_latest(self, limit: int = 30) -> AsyncIterator[RawArticleRef]:
        feed = await asyncio.to_thread(feedparser.parse, self.feed_url)
        
        for entry in feed.entries[:limit]:
            url = entry.get("link", "")
            if not url:
                continue
            
            pub_date = None
            if entry.get("published_parsed"):
                pub_date = datetime(*entry.published_parsed[:6])
            
            # Extraer imagen del enclosure o media:content
            imagen = None
            if entry.get("media_content"):
                imagen = entry["media_content"][0].get("url")
            elif entry.get("enclosures"):
                for enc in entry.enclosures:
                    if enc.get("type", "").startswith("image/"):
                        imagen = enc.get("href") or enc.get("url")
                        break
            
            yield RawArticleRef(
                url=url,
                titular=entry.get("title", ""),
                fuente=self.fuente_nombre,
                dominio=self.feed_url.split("/")[2] if "/" in self.feed_url else "",
                fecha_publicacion=pub_date,
                descripcion_preview=entry.get("summary", ""),
                imagen_preview=imagen,
                source_type=self.source_type,
                source_feed_id=self.feed_id,
                raw_metadata={
                    "tags": [t.get("term") for t in entry.get("tags", [])],
                    "author": entry.get("author", ""),
                    "id": entry.get("id", "")
                }
            )
    
    async def health_check(self) -> bool:
        feed = await asyncio.to_thread(feedparser.parse, self.feed_url)
        return feed.bozo == 0 and len(feed.entries) > 0
```

---

### FUENTE 4 — NewsAPI.org

**Librería:** `newsapi-python==0.2.7`  
**Plan gratuito:** 100 requests/día, últimas 24h, max 100 resultados  
**Plan de pago:** acceso histórico ilimitado, sources completas  
**Variable de entorno:** `NEWSAPI_KEY`  
**Ideal para:** búsquedas por keyword, filtrado por dominio específico

```python
# ai-engine/ingestion/sources/newsapi_source.py

from newsapi import NewsApiClient
from ingestion.base import NewsSource, RawArticleRef
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
        self.client = NewsApiClient(api_key=os.environ["NEWSAPI_KEY"])
    
    async def fetch_latest(self, limit: int = 100) -> AsyncIterator[RawArticleRef]:
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        
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
                dominio=article.get("source", {}).get("id", ""),
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
    
    async def search(self, query: str, days_back: int = 7) -> list[RawArticleRef]:
        """Búsqueda histórica por keyword."""
        from_date = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")
        
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
                dominio=article.get("source", {}).get("id", ""),
                fecha_publicacion=None,
                descripcion_preview=article.get("description"),
                imagen_preview=article.get("urlToImage"),
                source_type=self.source_type,
                source_feed_id=f"newsapi_search_{query[:20]}",
                raw_metadata=article
            ))
        return results
    
    async def health_check(self) -> bool:
        try:
            r = await asyncio.to_thread(self.client.get_sources, language="es")
            return r.get("status") == "ok"
        except Exception:
            return False
```

---

### FUENTE 5 — Mediastack API

**Librería:** `requests` (API REST directa, sin SDK oficial)  
**Plan gratuito:** 500 requests/mes, acceso a noticias en tiempo real  
**Variable de entorno:** `MEDIASTACK_API_KEY`  
**Ideal para:** fuente de backup con alta cobertura latinoamericana

```python
# ai-engine/ingestion/sources/mediastack_source.py

import httpx
from ingestion.base import NewsSource, RawArticleRef
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
        self.api_key = os.environ["MEDIASTACK_API_KEY"]
    
    async def fetch_latest(self, limit: int = 50) -> AsyncIterator[RawArticleRef]:
        params = {
            "access_key": self.api_key,
            "languages": "es",
            "sort": "published_desc",
            "limit": min(limit, 100),
            "countries": "es,mx,ar,co,cl,pe,ve,uy,bo,ec,py,do,cr,gt,hn,sv,ni,pa,cu,pr"
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{self.BASE_URL}/news", params=params)
            response.raise_for_status()
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
                dominio=article.get("source", ""),
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
    
    async def health_check(self) -> bool:
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(
                    f"{self.BASE_URL}/news",
                    params={"access_key": self.api_key, "languages": "es", "limit": 1}
                )
                return r.status_code == 200
        except Exception:
            return False
```

---

### FUENTE 6 — Scraping Directo de Portadas (newspaper4k)

**Librería:** `newspaper4k==0.9.3.1` (fork mantenido de newspaper3k)  
**Sin API key requerida**  
**Ideal para:** medios importantes que no tienen RSS completo o cuyo RSS omite artículos

```python
# ai-engine/ingestion/sources/direct_scrape_source.py

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
            return len(self.newspaper_source.articles) > 0
        except Exception:
            return False
```

---

### ORQUESTADOR DE INGESTA

El orquestador unifica todas las fuentes, deduplica por URL y encola artículos nuevos para análisis:

```python
# ai-engine/ingestion/ingestion_manager.py

import asyncio
import hashlib
from datetime import datetime
from typing import List
from ingestion.base import RawArticleRef
from ingestion.sources.gnews_source import GNewsSource
from ingestion.sources.google_news_rss_source import GoogleNewsRSSSource
from ingestion.sources.rss_source import RSSSource, DEFAULT_RSS_FEEDS
from ingestion.sources.newsapi_source import NewsAPISource
from ingestion.sources.mediastack_source import MediastackSource
from database.postgres import get_db_session
import logging

logger = logging.getLogger(__name__)

class IngestionManager:
    """
    Gestiona todas las fuentes de ingesta y coordina la deduplicación.
    Se ejecuta periódicamente via Celery Beat.
    """
    
    def __init__(self):
        self.sources = self._build_sources()
    
    def _build_sources(self) -> list:
        sources = []
        
        # Google News API (si hay key configurada)
        import os
        if os.environ.get("GNEWS_API_KEY"):
            sources.append(GNewsSource())
        
        # Google News RSS (siempre disponible, sin key)
        sources.append(GoogleNewsRSSSource())
        
        # RSS feeds del catálogo (cargados desde DB + defaults)
        for feed_id, feed_url in DEFAULT_RSS_FEEDS.items():
            # Inferir nombre del medio desde el ID del feed
            nombre = feed_id.replace("_", " ").replace("portada", "").title().strip()
            sources.append(RSSSource(feed_id, feed_url, nombre))
        
        # NewsAPI (si hay key)
        if os.environ.get("NEWSAPI_KEY"):
            sources.append(NewsAPISource())
        
        # Mediastack (si hay key)
        if os.environ.get("MEDIASTACK_API_KEY"):
            sources.append(MediastackSource())
        
        return sources
    
    @staticmethod
    def compute_url_hash(url: str) -> str:
        """SHA-256 de la URL normalizada para deduplicación."""
        normalized = url.lower().strip().rstrip("/")
        return hashlib.sha256(normalized.encode()).hexdigest()
    
    async def run_ingestion_cycle(self) -> dict:
        """
        Ciclo completo de ingesta:
        1. Fetch desde todas las fuentes en paralelo
        2. Deduplicar contra BD
        3. Encolar artículos nuevos para análisis
        """
        all_refs: List[RawArticleRef] = []
        
        # Fetch en paralelo desde todas las fuentes
        tasks = [self._safe_fetch(source) for source in self.sources]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for result in results:
            if isinstance(result, list):
                all_refs.extend(result)
        
        # Deduplicar por URL hash en memoria
        seen_hashes = set()
        unique_refs = []
        for ref in all_refs:
            h = self.compute_url_hash(ref.url)
            if h not in seen_hashes:
                seen_hashes.add(h)
                unique_refs.append(ref)
        
        # Filtrar URLs ya existentes en PostgreSQL
        new_refs = await self._filter_already_processed(unique_refs)
        
        # Encolar para análisis
        enqueued = 0
        from tasks.celery_tasks import analyze_article_task
        for ref in new_refs:
            analyze_article_task.apply_async(
                args=[ref.url, ref.__dict__],
                queue="default"
            )
            enqueued += 1
        
        logger.info(f"Ingestion cycle: {len(all_refs)} total, "
                   f"{len(unique_refs)} unique, "
                   f"{len(new_refs)} new, {enqueued} enqueued")
        
        return {
            "total_fetched": len(all_refs),
            "unique": len(unique_refs),
            "new": len(new_refs),
            "enqueued": enqueued,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    async def _safe_fetch(self, source) -> list:
        """Fetch con manejo de errores para que un fallo no bloquee las demás."""
        try:
            refs = []
            async for ref in source.fetch_latest(limit=50):
                refs.append(ref)
            return refs
        except Exception as e:
            logger.error(f"Source {source.source_type} failed: {e}")
            return []
    
    async def _filter_already_processed(
        self, refs: List[RawArticleRef]
    ) -> List[RawArticleRef]:
        """Consulta PostgreSQL para filtrar URLs ya procesadas."""
        if not refs:
            return []
        
        url_hashes = [self.compute_url_hash(r.url) for r in refs]
        
        async with get_db_session() as db:
            # Consulta batch: todos los hashes que ya existen
            existing = await db.execute(
                "SELECT url_hash FROM news_analysis WHERE url_hash = ANY($1)",
                [url_hashes]
            )
            existing_hashes = {row["url_hash"] for row in existing}
        
        return [
            ref for ref, h in zip(refs, url_hashes)
            if h not in existing_hashes
        ]
```

---

### CELERY BEAT — PROGRAMACIÓN DE INGESTA

```python
# ai-engine/celeryconfig.py

from celery.schedules import crontab

beat_schedule = {
    # Ciclo de ingesta principal — cada 15 minutos
    "ingestion-cycle": {
        "task": "tasks.ingestion_tasks.run_ingestion_cycle",
        "schedule": 60 * 15,  # 900 segundos
        "options": {"queue": "low_priority"}
    },
    
    # Ingesta prioritaria de medios principales — cada 5 minutos
    "ingestion-priority-feeds": {
        "task": "tasks.ingestion_tasks.run_priority_feeds",
        "schedule": 60 * 5,
        "options": {"queue": "default"}
    },
    
    # Health check de todas las fuentes — cada hora
    "sources-health-check": {
        "task": "tasks.ingestion_tasks.check_sources_health",
        "schedule": crontab(minute=0),  # en punto cada hora
        "options": {"queue": "low_priority"}
    },
    
    # Limpieza de caché de URLs procesadas — diaria
    "cache-cleanup": {
        "task": "tasks.maintenance_tasks.cleanup_old_cache",
        "schedule": crontab(hour=3, minute=0),  # 3am
        "options": {"queue": "low_priority"}
    },
}

# Colas con prioridad
task_queues = {
    "high_priority": {"exchange": "high_priority", "routing_key": "high"},
    "default":       {"exchange": "default",       "routing_key": "default"},
    "low_priority":  {"exchange": "low_priority",  "routing_key": "low"},
}
```

---

## 📁 ESTRUCTURA DE DIRECTORIOS REQUERIDA

```
newsanalyzer/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/              # shadcn/ui components
│   │   │   ├── analysis/        # Visualización de análisis
│   │   │   ├── dashboard/       # Widgets del dashboard
│   │   │   ├── sources/         # Gestión de fuentes
│   │   │   └── layout/          # Shell, sidebar, header
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── AnalysisDetail.tsx
│   │   │   ├── Explorer.tsx
│   │   │   ├── CrossMedia.tsx
│   │   │   ├── Sources.tsx      # Gestión de feeds RSS y fuentes
│   │   │   └── Settings.tsx
│   │   ├── stores/
│   │   ├── api/
│   │   └── types/
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.ts
│
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # Schema completo de PostgreSQL
│   │   └── seed.ts              # Seeds iniciales (feeds RSS, usuarios)
│   ├── src/
│   │   ├── routes/
│   │   │   ├── analysis.ts
│   │   │   ├── auth.ts
│   │   │   ├── dashboard.ts
│   │   │   ├── sources.ts       # CRUD de feeds RSS
│   │   │   └── media.ts
│   │   ├── middleware/
│   │   └── services/
│   └── package.json
│
├── ai-engine/
│   ├── ingestion/
│   │   ├── base.py              # Interfaz NewsSource + RawArticleRef
│   │   ├── ingestion_manager.py # Orquestador de ingesta
│   │   └── sources/
│   │       ├── gnews_source.py
│   │       ├── google_news_rss_source.py
│   │       ├── rss_source.py
│   │       ├── newsapi_source.py
│   │       ├── mediastack_source.py
│   │       └── direct_scrape_source.py
│   ├── agents/
│   │   ├── orchestrator.py
│   │   ├── state.py
│   │   └── nodes/
│   │       ├── scraper_node.py
│   │       ├── nlp_node.py
│   │       ├── llm_analysis_node.py
│   │       ├── search_node.py
│   │       ├── crossmedia_node.py
│   │       └── scoring_node.py
│   ├── nlp/
│   │   ├── spacy_pipeline.py
│   │   ├── sentiment.py
│   │   ├── keywords.py
│   │   ├── readability.py
│   │   └── quotes_extractor.py
│   ├── scraper/
│   │   ├── smart_scraper.py
│   │   └── wayback.py
│   ├── schemas/
│   │   ├── news_analysis.py
│   │   └── llm_outputs.py
│   ├── prompts/
│   │   └── analysis_prompts.py
│   ├── llm/
│   │   └── openrouter_client.py
│   ├── tasks/
│   │   ├── celery_tasks.py
│   │   └── ingestion_tasks.py
│   ├── api/
│   │   └── main.py
│   ├── database/
│   │   └── postgres.py          # Pool de conexiones async
│   ├── tests/
│   ├── requirements.txt
│   └── celeryconfig.py
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🗄️ SCHEMA POSTGRESQL CON PRISMA

```prisma
// backend/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── USUARIOS ────────────────────────────────────────────────────────────────
model User {
  id          String   @id @default(uuid())
  email       String   @unique
  passwordHash String  @map("password_hash")
  name        String?
  role        Role     @default(USER)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  analyses    NewsAnalysis[]
  watchlists  Watchlist[]
  @@map("users")
}

enum Role {
  USER
  ADMIN
}

// ─── FEEDS RSS / FUENTES ─────────────────────────────────────────────────────
model RssFeed {
  id          String   @id @default(uuid())
  feedId      String   @unique @map("feed_id")       // ej: "elpais_portada"
  url         String   @unique
  nombre      String
  dominio     String
  pais        String   @default("ES")
  idioma      String   @default("es")
  categoria   String?
  activo      Boolean  @default(true)
  esDefault   Boolean  @default(false) @map("es_default")
  ultimaIngesta DateTime? @map("ultima_ingesta")
  errorCount  Int      @default(0) @map("error_count")
  createdAt   DateTime @default(now()) @map("created_at")
  @@map("rss_feeds")
}

// ─── ANÁLISIS PRINCIPAL ───────────────────────────────────────────────────────
model NewsAnalysis {
  id                String    @id @default(uuid())
  urlHash           String    @unique @map("url_hash")
  url               String    @unique
  urlCanonica       String?   @map("url_canonica")

  // Campos extraídos para queries rápidas (no entrar en JSONB)
  titular           String
  fuente            String
  dominio           String
  pais              String    @default("ES")
  idioma            String    @default("es")
  seccion           String?
  categoria         String?
  autor             String[]
  fechaPublicacion  DateTime? @map("fecha_publicacion")
  fechaExtraccion   DateTime  @default(now()) @map("fecha_extraccion")

  // Campos analíticos indexados
  sentimientoLabel  String?   @map("sentimiento_label")
  sentimientoScore  Float?    @map("sentimiento_score")
  subjetividad      Float?
  sesgoPolitico     String?   @map("sesgo_politico")
  sesgoCon          Float?    @map("sesgo_confianza")
  framingPrincipal  String?   @map("framing_principal")
  esOpinion         Boolean   @default(false) @map("es_opinion")
  esPatrocinado     Boolean   @default(false) @map("es_patrocinado")
  tienPaywall       Boolean   @default(false) @map("tiene_paywall")

  // Scores indexados
  scoreCalidad      Float?    @map("score_calidad")
  scoreDesin        Float?    @map("score_desinformacion")
  scoreClickbait    Float?    @map("score_clickbait")
  scoreSesgo        Float?    @map("score_sesgo")
  scoreOriginalidad Float?    @map("score_originalidad")
  scoreGlobal       Float?    @map("score_global")

  // Estado del pipeline
  status            AnalysisStatus @default(PENDING)
  errorMessage      String?   @map("error_message")
  processingMs      Int?      @map("processing_ms")
  costoUsd          Float?    @map("costo_usd")
  modeloLlm         String?   @map("modelo_llm")

  // Fuente de ingesta
  sourceType        String?   @map("source_type")
  sourceFeedId      String?   @map("source_feed_id")

  // JSON completo (todo el análisis)
  analysisData      Json      @map("analysis_data")

  // Relaciones
  userId            String?   @map("user_id")
  user              User?     @relation(fields: [userId], references: [id])
  eventId           String?   @map("event_id")
  event             NewsEvent? @relation(fields: [eventId], references: [id])

  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")

  @@index([fuente])
  @@index([fechaPublicacion(sort: Desc)])
  @@index([sentimientoLabel])
  @@index([sesgoPolitico])
  @@index([categoria])
  @@index([sourceType])
  @@index([status])
  @@index([scoreGlobal])
  @@map("news_analysis")
}

enum AnalysisStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

// ─── EVENTOS (cross-media grouping) ──────────────────────────────────────────
model NewsEvent {
  id          String   @id @default(uuid())
  eventId     String   @unique @map("event_id")   // ej: "bce-tipos-feb2026"
  titulo      String
  descripcion String?
  temaParague String?  @map("tema_paraguas")
  primeraCobertura DateTime? @map("primera_cobertura")
  analyses    NewsAnalysis[]
  createdAt   DateTime @default(now()) @map("created_at")
  @@map("news_events")
}

// ─── WATCHLISTS ───────────────────────────────────────────────────────────────
model Watchlist {
  id          String   @id @default(uuid())
  nombre      String
  descripcion String?
  queries     String[]           // Keywords a monitorizar
  medios      String[]           // Fuentes específicas a vigilar
  activa      Boolean  @default(true)
  frecuencia  Int      @default(30)  // minutos entre checks
  userId      String   @map("user_id")
  user        User     @relation(fields: [userId], references: [id])
  alerts      Alert[]
  createdAt   DateTime @default(now()) @map("created_at")
  @@map("watchlists")
}

// ─── ALERTAS ─────────────────────────────────────────────────────────────────
model Alert {
  id           String   @id @default(uuid())
  tipo         String   // "desinformacion" | "cambio_titular" | "nueva_cobertura"
  descripcion  String
  leida        Boolean  @default(false)
  analysisId   String?  @map("analysis_id")
  watchlistId  String?  @map("watchlist_id")
  watchlist    Watchlist? @relation(fields: [watchlistId], references: [id])
  createdAt    DateTime @default(now()) @map("created_at")
  @@map("alerts")
}
```

---

## 📊 SCHEMA JSON COMPLETO — EJEMPLO DE SALIDA

```json
{
  "metadata": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "url": "https://elpais.com/economia/2026-02-10/bce-sube-tipos.html",
    "url_canonica": "https://elpais.com/economia/2026-02-10/bce-sube-tipos.html",
    "url_hash": "sha256:a3f1b2c4d5e6f7a8b9c0d1e2f3a4b5c6",
    "fecha_extraccion": "2026-02-18T10:30:00Z",
    "fecha_publicacion": "2026-02-10T08:00:00Z",
    "fecha_modificacion": "2026-02-10T14:22:00Z",
    "fuente": "El País",
    "dominio": "elpais.com",
    "pais_fuente": "ES",
    "idioma_detectado": "es",
    "idioma_confianza": 0.99,
    "seccion": "Economía",
    "autor": ["Ana García", "Luis Martínez"],
    "tags_originales": ["inflación", "BCE", "zona euro"],
    "tiene_paywall": false,
    "metodo_extraccion": "trafilatura",
    "source_type": "rss",
    "source_feed_id": "elpais_economia",
    "tiempo_extraccion_ms": 1240
  },

  "contenido": {
    "titular": "El BCE sube los tipos de interés por quinta vez consecutiva ante la persistencia de la inflación",
    "subtitular": "La institución europea eleva el precio del dinero al 4,5%, el nivel más alto desde 2001",
    "entradilla": "El Banco Central Europeo ha decidido este jueves incrementar los tipos de interés en 25 puntos básicos...",
    "cuerpo_completo": "TEXTO COMPLETO DEL ARTÍCULO...",
    "cuerpo_limpio": "Texto sin anuncios ni boilerplate...",
    "num_palabras": 820,
    "num_caracteres": 4890,
    "num_parrafos": 12,
    "num_oraciones": 38,
    "tiene_actualizaciones": true,
    "nota_actualizacion": "Actualizado con declaraciones del presidente del BCE"
  },

  "clasificacion": {
    "categoria_principal": "Economía",
    "categorias_secundarias": ["Política monetaria", "Unión Europea"],
    "tipo_contenido": "noticia",
    "ambito_geografico": ["Europa", "Zona Euro", "España"],
    "nivel_geografico": "internacional",
    "es_opinion": false,
    "es_editorial": false,
    "es_patrocinado": false,
    "es_breaking_news": false,
    "es_seguimiento": true,
    "tema_paraguas": "politica-monetaria-bce-2025",
    "evento_id": "bce-tipos-feb2026"
  },

  "analisis_nlp": {
    "entidades": [
      {
        "texto": "BCE",
        "texto_completo": "Banco Central Europeo",
        "tipo": "ORG",
        "subtipo": "institución_financiera",
        "relevancia": 0.96,
        "menciones": 8,
        "primera_mencion_posicion": 0,
        "wikidata_id": "Q8685"
      },
      {
        "texto": "Christine Lagarde",
        "tipo": "PER",
        "subtipo": "cargo_institucional",
        "cargo": "Presidenta del BCE",
        "relevancia": 0.78,
        "menciones": 3,
        "primera_mencion_posicion": 4,
        "wikidata_id": "Q235864"
      }
    ],
    "sentimiento_global": {
      "label": "negativo",
      "score": -0.58,
      "confianza": 0.87
    },
    "sentimiento_por_parrafo": [
      { "parrafo": 0, "label": "neutro", "score": -0.05 },
      { "parrafo": 1, "label": "negativo", "score": -0.72 }
    ],
    "emociones": {
      "alegria": 0.04,
      "tristeza": 0.31,
      "enojo": 0.18,
      "miedo": 0.42,
      "sorpresa": 0.12,
      "disgusto": 0.09,
      "confianza": 0.22,
      "anticipacion": 0.35
    },
    "subjetividad": 0.38,
    "subjetividad_label": "moderadamente_objetivo",
    "keywords": [
      { "keyword": "tipos de interés", "score": 0.94, "frecuencia": 7 },
      { "keyword": "BCE", "score": 0.91, "frecuencia": 8 },
      { "keyword": "inflación zona euro", "score": 0.88, "frecuencia": 4 }
    ],
    "citas_textuales": [
      {
        "texto": "La inflación sigue siendo demasiado elevada",
        "atribuida_a": "Christine Lagarde",
        "cargo_hablante": "Presidenta del BCE",
        "tipo_cita": "directa",
        "verificable": true
      }
    ],
    "metricas_texto": {
      "densidad_lexica": 0.61,
      "type_token_ratio": 0.73,
      "indice_legibilidad_mu": 67.4,
      "nivel_lector_recomendado": "bachillerato",
      "longitud_media_oracion": 21.6,
      "ratio_citas_sobre_texto": 0.14,
      "porcentaje_parrafos_con_datos": 0.58
    }
  },

  "analisis_linguistico": {
    "uso_voz_pasiva": true,
    "ratio_voz_pasiva": 0.31,
    "ejemplos_agentividad_pasiva": ["los tipos fueron subidos", "las familias se verán afectadas"],
    "ejemplos_agentividad_activa": ["el BCE decide subir", "Lagarde defiende la medida"],
    "metaforas_detectadas": ["guerra contra la inflación", "aterrizaje suave"],
    "lenguaje_carga_emocional": [
      { "termino": "persistencia", "carga": "negativa", "intensidad": 0.6 },
      { "termino": "presiona", "carga": "negativa", "intensidad": 0.7 }
    ],
    "verbos_hecho": ["anuncia", "sube", "incrementa"],
    "verbos_opinion": ["considera", "advierte"],
    "uso_superlativos": 2,
    "uso_adverbios_intensificadores": ["extremadamente", "particularmente"]
  },

  "framing": {
    "enfoque_predominante": "crisis_economica",
    "marcos_narrativos": [
      {
        "marco": "crisis_economica",
        "confianza": 0.84,
        "evidencias": ["uso de 'persistencia'", "énfasis en impacto negativo"]
      },
      {
        "marco": "accion_institucional",
        "confianza": 0.71,
        "evidencias": ["protagonismo del BCE", "citas de autoridad institucional"]
      }
    ],
    "enfoque_solucion_vs_problema": "problema",
    "perspectiva_temporal": "corto_plazo",
    "grupos_beneficiados_segun_texto": ["ahorradores"],
    "grupos_perjudicados_segun_texto": ["hipotecados", "empresas con deuda variable"],
    "rol_lector_implicito": "ciudadano_afectado_pasivo",
    "llamada_a_accion_implicita": "preocuparse",
    "metaforas_detectadas": ["guerra contra la inflación", "tormenta perfecta"],
    "confianza_framing": 0.79
  },

  "sesgo": {
    "orientacion_politica_estimada": "centro",
    "confianza_orientacion": 0.62,
    "voces_incluidas": [
      { "actor": "BCE / Christine Lagarde", "tipo": "institucional_europeo", "espacio_relativo": 0.45 },
      { "actor": "economistas", "tipo": "expertos", "espacio_relativo": 0.28 }
    ],
    "voces_ausentes": ["sindicatos", "pequeñas empresas", "gobierno español"],
    "equilibrio_fuentes_score": 0.61,
    "uso_fuentes_anonimas": true,
    "ratio_fuentes_anonimas": 0.33,
    "sesgo_confirmacion_detectado": false,
    "notas_sesgo": "Cobertura técnico-institucional con limitada perspectiva ciudadana"
  },

  "fuentes": {
    "num_fuentes_total": 6,
    "num_fuentes_nombradas": 4,
    "num_fuentes_anonimas": 2,
    "detalle": [
      {
        "texto_referencia": "Christine Lagarde, presidenta del BCE",
        "actor": "Christine Lagarde",
        "tipo": "institucional",
        "anonima": false,
        "verificable": true
      },
      {
        "texto_referencia": "fuentes del mercado",
        "actor": null,
        "tipo": "anonima",
        "anonima": true,
        "verificable": false
      }
    ],
    "score_diversidad_fuentes": 0.68
  },

  "calidad_periodistica": {
    "score_global": 0.74,
    "tiene_datos_verificables": true,
    "tiene_contexto_historico": true,
    "tiene_multiples_perspectivas": false,
    "tiene_respuesta_afectados": false,
    "claridad_distincion_hecho_opinion": true,
    "titular_respaldado_por_cuerpo": true,
    "clickbait_score": 0.18,
    "sensacionalismo_score": 0.24,
    "rigor_datos_score": 0.81
  },

  "riesgo_desinformacion": {
    "score_global": 0.14,
    "nivel": "bajo",
    "alertas": [],
    "titular_coherente_con_cuerpo": true,
    "datos_sin_fuente": false,
    "exageracion_detectada": false,
    "contexto_omitido_relevante": true,
    "nota_contexto_omitido": "No menciona que otros bancos centrales mantienen tipos",
    "fact_checks_encontrados": []
  },

  "cobertura_comparada": {
    "evento_id": "bce-tipos-feb2026",
    "otros_medios_encontrados": [
      {
        "medio": "El Mundo",
        "url": "https://elmundo.es/...",
        "titular": "El BCE endurece su política monetaria con otra subida de tipos",
        "enfoque": "impacto_en_hipotecas",
        "tono": "alarmista",
        "voces_exclusivas": ["Asociación Hipotecaria Española"]
      },
      {
        "medio": "La Vanguardia",
        "url": "https://lavanguardia.com/...",
        "titular": "El BCE sube tipos al 4,5% para frenar la inflación",
        "enfoque": "institucional_tecnico",
        "tono": "neutro",
        "voces_exclusivas": []
      }
    ],
    "angulo_unico_este_medio": false,
    "horas_retraso_vs_primero": 1.2,
    "diferencias_framing": {
      "este_medio": "accion_institucional",
      "El Mundo": "impacto_ciudadano_negativo",
      "La Vanguardia": "institucional_tecnico"
    },
    "consensus_narrativo": "subida_tipos_como_problema"
  },

  "historial_ediciones": [
    {
      "timestamp": "2026-02-10T08:00:00Z",
      "version": 1,
      "titular_en_esta_version": "El BCE sube tipos al 4,5%",
      "tipo_cambio": "publicacion_inicial"
    },
    {
      "timestamp": "2026-02-10T14:22:00Z",
      "version": 2,
      "titular_en_esta_version": "El BCE sube los tipos de interés por quinta vez consecutiva ante la persistencia de la inflación",
      "tipo_cambio": "expansion_titular"
    }
  ],

  "scores_finales": {
    "calidad_periodistica": 0.74,
    "riesgo_desinformacion": 0.14,
    "clickbait": 0.18,
    "sesgo_editorial": 0.38,
    "diversidad_fuentes": 0.68,
    "originalidad": 0.61,
    "score_compuesto_global": 0.72
  },

  "resumen_ejecutivo": "El BCE sube tipos al 4,5% por quinta vez consecutiva citando persistencia de la inflación. Cobertura técnico-institucional con predominio de fuentes del sector financiero y limitada perspectiva ciudadana. Calidad periodística buena pero ausencia de voces críticas y contexto comparativo internacional.",

  "pipeline_metadata": {
    "version_pipeline": "1.0.0",
    "modelo_llm": "google/gemini-flash-2.5",
    "proveedor_llm": "openrouter",
    "tiempo_total_ms": 18420,
    "tokens_entrada_llm": 1840,
    "tokens_salida_llm": 920,
    "costo_estimado_usd": 0.0031,
    "nodos_completados": ["scraper", "nlp", "llm_analysis", "search", "crossmedia", "scoring"],
    "nodos_fallidos": [],
    "source_type": "rss",
    "source_feed_id": "elpais_economia"
  }
}
```

---

## 🔬 LIBRERÍAS PYTHON — MAPEO COMPLETO POR CAMPO

```python
# requirements.txt completo

# ─── INGESTA ────────────────────────────────────────────────
gnews==0.3.7                     # Google News API
pygooglenews==0.1.2              # Google News RSS (sin key)
feedparser==6.0.11               # RSS/Atom feeds
newsapi-python==0.2.7            # NewsAPI.org
httpx==0.27.0                    # Mediastack + requests async
newspaper4k==0.9.3.1             # Scraping directo portadas

# ─── EXTRACCIÓN DE ARTÍCULOS ────────────────────────────────
trafilatura==1.8.0               # Extracción texto + metadatos
playwright==1.44.0               # Fallback JS rendering
beautifulsoup4==4.12.3           # HTML parsing adicional
lxml==5.2.1                      # Parser rápido para BS4
python-dateutil==2.9.0           # Normalización de fechas
validators==0.28.1               # Validación URLs
requests==2.31.0                 # Wayback Machine API

# ─── NLP ────────────────────────────────────────────────────
spacy==3.7.4                     # NER, POS, dependencias (es_core_news_lg)
pysentimiento==0.7.2             # Sentimiento + emociones en español
keybert==0.8.4                   # Keywords con BERT
sentence-transformers==2.7.0    # Modelo paraphrase-multilingual-MiniLM-L12-v2
nltk==3.8.1                      # TTR, tokenización, métricas
langdetect==1.0.9                # Detección de idioma

# ─── LLM / AGENTE ───────────────────────────────────────────
langgraph==0.1.5                 # Agente orquestador
langchain-core==0.2.0            # Tipos base de LangChain
tavily-python==0.3.3             # Búsqueda web semántica (cross-media)
SPARQLWrapper==2.0.0             # Wikidata para enriquecer entidades

# ─── FRAMEWORK / INFRAESTRUCTURA ────────────────────────────
fastapi==0.111.0
uvicorn==0.30.0
celery==5.4.0
redis==5.0.4
pydantic==2.7.0
pydantic-settings==2.2.1
asyncpg==0.29.0                  # Driver async para PostgreSQL
structlog==24.1.0                # Logging estructurado JSON
```

---

## 🤖 INTEGRACIÓN OPENROUTER + GEMINI FLASH 2.5

```python
# ai-engine/llm/openrouter_client.py

import os
import httpx
from typing import TypeVar, Type
from pydantic import BaseModel

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "google/gemini-flash-2.5")

T = TypeVar("T", bound=BaseModel)

class OpenRouterClient:
    def __init__(self):
        self.api_key = os.environ["OPENROUTER_API_KEY"]
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": os.environ.get("APP_URL", "http://localhost:3000"),
            "X-Title": "Newsyx",
            "Content-Type": "application/json"
        }

    async def complete_structured(
        self,
        system_prompt: str,
        user_content: str,
        output_schema: Type[T],
        temperature: float = 0.1,
        max_tokens: int = 4096
    ) -> T:
        payload = {
            "model": OPENROUTER_MODEL,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": output_schema.__name__,
                    "strict": True,
                    "schema": output_schema.model_json_schema()
                }
            },
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ]
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{OPENROUTER_BASE_URL}/chat/completions",
                headers=self.headers,
                json=payload
            )
            response.raise_for_status()
            data = response.json()

        raw = data["choices"][0]["message"]["content"].strip()
        # Limpiar posibles bloques markdown que Gemini añade
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip().rstrip("```")

        return output_schema.model_validate_json(raw)
```

---

## 📝 PROMPTS DEL SISTEMA

```python
# ai-engine/prompts/analysis_prompts.py

ANALYSIS_SYSTEM_PROMPT = """
Eres un analista periodístico experto especializado en medios de comunicación en español.
Analiza la noticia proporcionada y devuelve ÚNICAMENTE un objeto JSON válido.

REGLAS:
- Solo JSON válido. Sin markdown, sin explicaciones.
- null para campos donde tu confianza sea < 0.6.
- Scores de confianza: float entre 0.0 y 1.0.
- No inventes datos ni atribuciones que no estén en el texto.
- El análisis debe basarse exclusivamente en el texto dado.

SCHEMA REQUERIDO:
{
  "framing": {
    "enfoque_predominante": "conflicto_politico|crisis_economica|accion_institucional|impacto_ciudadano|denuncia_social|celebracion|tragedia|escandalo|avance_cientifico|otro",
    "marcos_narrativos": [{"marco": "string", "confianza": 0.0, "evidencias": ["string"]}],
    "enfoque_solucion_vs_problema": "solucion|problema|mixto|ninguno",
    "perspectiva_temporal": "pasado|presente|futuro|mixto",
    "grupos_beneficiados_segun_texto": ["string"],
    "grupos_perjudicados_segun_texto": ["string"],
    "rol_lector_implicito": "ciudadano_afectado|consumidor|votante|espectador_pasivo|agente_cambio|otro",
    "llamada_a_accion_implicita": "ninguna|preocuparse|actuar|informarse|indignarse|celebrar|otro",
    "lenguaje_carga_emocional": [{"termino": "string", "carga": "positiva|negativa|neutra", "intensidad": 0.0}],
    "metaforas_detectadas": ["string"],
    "confianza_framing": 0.0
  },
  "sesgo": {
    "orientacion_politica_estimada": "izquierda|centro_izquierda|centro|centro_derecha|derecha|no_aplica|indeterminado",
    "confianza_orientacion": 0.0,
    "voces_incluidas": [{"actor": "string", "tipo": "gobierno|oposicion|institucional|experto|sociedad_civil|empresa|ciudadano|otro", "espacio_relativo": 0.0}],
    "voces_ausentes": ["string"],
    "sesgo_confirmacion_detectado": false,
    "notas_sesgo": "string o null"
  },
  "calidad_periodistica": {
    "tiene_multiples_perspectivas": false,
    "tiene_respuesta_afectados": false,
    "tiene_contexto_historico": false,
    "claridad_distincion_hecho_opinion": false,
    "titular_respaldado_por_cuerpo": false,
    "datos_sin_fuente": false,
    "exageracion_detectada": false,
    "contexto_omitido_relevante": false,
    "nota_contexto_omitido": "string o null"
  },
  "riesgo_desinformacion": {
    "alertas": ["string"],
    "coherencia_titular_cuerpo": true,
    "nota_incoherencia": "string o null"
  },
  "analisis_linguistico": {
    "uso_voz_pasiva": false,
    "ejemplos_agentividad_pasiva": ["string"],
    "ejemplos_agentividad_activa": ["string"],
    "verbos_hecho": ["string"],
    "verbos_opinion": ["string"],
    "uso_superlativos": 0,
    "uso_adverbios_intensificadores": ["string"]
  },
  "intencion_editorial": {
    "primaria": "informar|opinar|movilizar|alarmar|entretener|publicitar|otro",
    "score_informativo": 0.0,
    "score_opinion": 0.0,
    "score_movilizacion": 0.0,
    "score_alarmismo": 0.0
  },
  "resumen_ejecutivo": "Máximo 3 frases. Primera: qué ocurre (hechos). Segunda: cómo lo encuadra el medio. Tercera: alerta principal o null."
}
"""

CROSSMEDIA_COMPARISON_PROMPT = """
Eres un analista experto en comparación editorial entre medios hispanohablantes.
Se te dan fragmentos de cómo distintos medios cubren el mismo evento.
Devuelve SOLO JSON con este schema exacto:
{
  "diferencias_principales": ["string"],
  "consensus_narrativo": "string",
  "outlier_narrativo": false,
  "medio_mas_completo": "string o null",
  "angulos_exclusivos": [{"medio": "string", "angulo": "string"}]
}
"""
```

---

## ⚙️ VARIABLES DE ENTORNO

```bash
# .env.example

# ─── LLM ────────────────────────────────────────────────────
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=google/gemini-flash-2.5
APP_URL=http://localhost:3000

# ─── FUENTES DE NOTICIAS ─────────────────────────────────────
GNEWS_API_KEY=...                # https://gnews.io — 100 req/día gratis
NEWSAPI_KEY=...                  # https://newsapi.org — 100 req/día gratis
MEDIASTACK_API_KEY=...           # https://mediastack.com — 500 req/mes gratis
# pygooglenews y feedparser NO necesitan API key

# ─── BÚSQUEDA CROSS-MEDIA ────────────────────────────────────
TAVILY_API_KEY=tvly-...          # https://tavily.com — 1000 búsquedas/mes gratis

# ─── BASE DE DATOS ───────────────────────────────────────────
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/newsanalyzer
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2

# ─── BACKEND ─────────────────────────────────────────────────
JWT_SECRET=cambiar_en_produccion_minimo_32_caracteres
JWT_EXPIRY=24h
PORT=4000
AI_ENGINE_URL=http://localhost:8000

# ─── FRONTEND ────────────────────────────────────────────────
VITE_API_URL=http://localhost:4000/api

# ─── CONFIGURACIÓN PIPELINE ──────────────────────────────────
MAX_ARTICLE_WORDS=15000
MIN_ARTICLE_WORDS=50
SCRAPING_DELAY_MS=2000
ANALYSIS_TIMEOUT_SECONDS=120
CACHE_TTL_HOURS=24
LLM_MAX_TOKENS=4096
LLM_TEMPERATURE=0.1

# ─── FEATURE FLAGS ───────────────────────────────────────────
ENABLE_CROSSMEDIA_SEARCH=true
ENABLE_WAYBACK_CHECK=true
ENABLE_WIKIDATA_ENRICHMENT=false
ENABLE_GNEWS=true
ENABLE_NEWSAPI=true
ENABLE_MEDIASTACK=true
ENABLE_DIRECT_SCRAPE=true

# ─── INGESTA ─────────────────────────────────────────────────
INGESTION_CYCLE_MINUTES=15
PRIORITY_FEEDS_CYCLE_MINUTES=5
MAX_ARTICLES_PER_CYCLE=200
```

---

## 🐳 DOCKER COMPOSE

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: newsanalyzer
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  ai-engine:
    build:
      context: ./ai-engine
    ports:
      - "8000:8000"
    env_file: .env
    depends_on: [postgres, redis]
    volumes:
      - ./ai-engine:/app
    command: uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload

  celery-worker:
    build:
      context: ./ai-engine
    env_file: .env
    depends_on: [postgres, redis]
    volumes:
      - ./ai-engine:/app
    command: >
      celery -A tasks.celery_tasks worker
      --concurrency=4
      -Q high_priority,default,low_priority
      --loglevel=info

  celery-beat:
    build:
      context: ./ai-engine
    env_file: .env
    depends_on: [redis]
    volumes:
      - ./ai-engine:/app
    command: celery -A tasks.celery_tasks beat --loglevel=info

  flower:
    build:
      context: ./ai-engine
    ports:
      - "5555:5555"
    env_file: .env
    depends_on: [redis]
    command: celery -A tasks.celery_tasks flower --port=5555

  backend:
    build:
      context: ./backend
    ports:
      - "4000:4000"
    env_file: .env
    depends_on: [postgres, redis, ai-engine]
    volumes:
      - ./backend:/app
      - /app/node_modules
    command: sh -c "npx prisma migrate deploy && npm run dev"

  frontend:
    build:
      context: ./frontend
    ports:
      - "3000:3000"
    env_file: .env
    depends_on: [backend]
    volumes:
      - ./frontend:/app
      - /app/node_modules

volumes:
  postgres_data:
  redis_data:
```

---

## 📋 ORDEN DE IMPLEMENTACIÓN

Implementa exactamente en este orden. Verifica que cada paso funciona antes de continuar.

**PASO 1 — Estructura base + Docker**  
Directorios, `package.json`, `requirements.txt`, `docker-compose.yml`, `.env.example`. Levanta `docker compose up postgres redis` y verifica conectividad.

**PASO 2 — Schema Prisma + Migraciones**  
Implementa `schema.prisma` completo. Ejecuta `npx prisma migrate dev --name init`. Ejecuta seed con los `DEFAULT_RSS_FEEDS` cargados en tabla `rss_feeds`.

**PASO 3 — Schemas Pydantic**  
`ai-engine/schemas/news_analysis.py` y `llm_outputs.py`. Valida con el JSON de ejemplo antes de continuar.

**PASO 4 — Cliente OpenRouter**  
`ai-engine/llm/openrouter_client.py`. Testa con llamada simple a `google/gemini-flash-2.5`.

**PASO 5 — Módulo de Ingesta**  
Implementa todas las fuentes en orden: RSS (sin key) → Google News RSS (sin key) → GNews API → NewsAPI → Mediastack → Direct Scrape. Testa cada una independientemente. Implementa `IngestionManager`.

**PASO 6 — Smart Scraper**  
`ai-engine/scraper/smart_scraper.py` con fallback trafilatura/playwright. Testa con URLs reales de El País, BBC Mundo, Infobae.

**PASO 7 — NLP Pipeline**  
Cada módulo en `ai-engine/nlp/` testeado independientemente con texto en español de muestra.

**PASO 8 — Nodos LangGraph**  
Cada nodo por separado con estado mock, luego ensamblaje del grafo completo.

**PASO 9 — FastAPI + Celery Tasks**  
API endpoints y tasks de Celery incluyendo `run_ingestion_cycle` y `analyze_article_task`.

**PASO 10 — Backend Node.js**  
Express + Prisma + JWT. Todos los endpoints incluyendo el CRUD de feeds RSS.

**PASO 11 — Frontend React**  
Páginas en orden: Dashboard → AnalysisDetail → Explorer → Sources (gestión de feeds) → CrossMedia → Settings.

**PASO 12 — Tests + documentación**  
Tests de integración para scraper, NLP y ciclo de ingesta. README completo con instrucciones de setup.

---

## ✅ REGLAS ABSOLUTAS

1. **TypeScript strict** — zero `any` sin justificación comentada.
2. **Python type hints** — todo el código pasa `mypy --strict`.
3. **Fail gracefully** — si un nodo del agente falla, registra en `pipeline_errors` y continúa. Nunca bloquear el pipeline completo.
4. **Zero credenciales hardcodeadas** — validar presencia de env vars al arranque.
5. **Logging estructurado JSON** — `structlog` en Python, `winston` en Node.js.
6. **LLM fijo** — siempre `google/gemini-flash-2.5` via `openrouter.ai/api/v1` salvo que `OPENROUTER_MODEL` lo sobreescriba.
7. **Respeto robots.txt** — mínimo 2 segundos entre requests al mismo dominio.
8. **Idempotencia** — misma URL = mismo `url_hash` = no re-procesar si ya existe en PostgreSQL.
9. **Feature flags** — todas las fuentes de ingesta opcionales se activan/desactivan con las variables `ENABLE_*`.
10. **README al día** — actualizar al finalizar cada fase con instrucciones de ejecución.

---

*Newsyx — Prompt de Agente v2.0 | PostgreSQL + Prisma | OpenRouter → google/gemini-flash-2.5 | 6 fuentes de ingesta en español*
