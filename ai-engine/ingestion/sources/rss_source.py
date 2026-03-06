import feedparser
import asyncio
from datetime import datetime
from ingestion.base import NewsSource, RawArticleRef
from utils.domain_utils import get_base_domain
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
                dominio=get_base_domain(url),
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
