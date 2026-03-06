from urllib.parse import urlparse
import logging

logger = logging.getLogger(__name__)

def get_base_domain(url_or_domain: str) -> str:
    """
    Extrae el dominio base de una URL o cadena de dominio de forma robusta.
    Ejemplos:
    - "https://feeds.elpais.com/rss" -> "elpais.com"
    - "www.elmundo.es" -> "elmundo.es"
    - "elpais.com/seccion/..." -> "elpais.com"
    """
    if not url_or_domain:
        return ""
    
    # 1. Normalizar si es una URL completa
    if "://" in url_or_domain:
        try:
            parsed = urlparse(url_or_domain)
            domain = parsed.hostname or ""
        except Exception:
            domain = url_or_domain.split("/")[2] if "/" in url_or_domain else url_or_domain
    else:
        # Si es un path o similar, tomar la primera parte
        domain = url_or_domain.split("/")[0]

    domain = domain.lower().strip()
    
    # 2. Limpieza agresiva de subdominios
    # Intentamos quedarnos con el dominio raíz (ej: elpais.com)
    parts = domain.split(".")
    if len(parts) > 2:
        # Casos especiales de TLDs de dos niveles (ej: .com.ar, .org.es, .net.co)
        # Si la penúltima parte es muy corta o común, tomamos 3 niveles
        if parts[-2] in ["com", "org", "net", "gov", "edu", "gob", "nom"] or len(parts[-1]) == 2 and len(parts[-2]) <= 3:
            if len(parts) >= 3:
                return ".".join(parts[-3:])
        
        # Caso general: últimos dos niveles (ej: elpais.com, elmundo.es)
        return ".".join(parts[-2:])
            
    return domain
