"""
utils/source_metadata.py
A1 · Source Tiers — helper para obtener metadata de tier de una fuente dado su feedId.
Cachea en Redis (TTL 10 min) para evitar N+1 DB queries durante el pipeline de análisis.
"""
import json
import logging
import os
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

CACHE_TTL = 600  # 10 minutos


@dataclass
class SourceTierMetadata:
    feed_id: str
    nombre: str
    tier: int               # 1=wire service, 2=nacional, 3=especializado, 4=agregador
    propaganda_risk: float  # 0.0–1.0
    state_affiliated: bool
    political_lean: Optional[str]   # "izquierda"|"centroizquierda"|"centro"|"centroderecha"|"derecha"
    reach_scope: str                # "local"|"provincial"|"nacional"|"regional"|"global"
    country_origin: str


TIER_LABELS = {
    1: "Agencia de noticias / medio verificado",
    2: "Medio nacional consolidado",
    3: "Medio especializado / digital / provincial",
    4: "Agregador / blog / RSS sin redacción propia",
}


async def get_source_metadata(feed_id: str) -> Optional[SourceTierMetadata]:
    """
    Obtiene metadata de tier para un feedId.
    Intenta Redis → DB → None.
    """
    if not feed_id:
        return None

    # 1. Intentar desde cache Redis
    cached = await _get_from_cache(feed_id)
    if cached:
        return cached

    # 2. Buscar en DB
    metadata = await _get_from_db(feed_id)
    if metadata:
        await _save_to_cache(feed_id, metadata)

    return metadata


async def _get_from_cache(feed_id: str) -> Optional[SourceTierMetadata]:
    try:
        from llm.router import get_redis_client
        redis = await get_redis_client()
        if not redis:
            return None

        key = f"source_tier:{feed_id}"
        raw = await redis.get(key)
        if raw:
            data = json.loads(raw)
            return SourceTierMetadata(**data)
    except Exception as e:
        logger.debug(f"Redis cache miss for source_tier:{feed_id}: {e}")
    return None


async def _save_to_cache(feed_id: str, metadata: SourceTierMetadata) -> None:
    try:
        from llm.router import get_redis_client
        redis = await get_redis_client()
        if not redis:
            return

        key = f"source_tier:{feed_id}"
        data = {
            "feed_id": metadata.feed_id,
            "nombre": metadata.nombre,
            "tier": metadata.tier,
            "propaganda_risk": metadata.propaganda_risk,
            "state_affiliated": metadata.state_affiliated,
            "political_lean": metadata.political_lean,
            "reach_scope": metadata.reach_scope,
            "country_origin": metadata.country_origin,
        }
        await redis.setex(key, CACHE_TTL, json.dumps(data))
    except Exception as e:
        logger.debug(f"Failed to cache source metadata for {feed_id}: {e}")


async def _get_from_db(feed_id: str) -> Optional[SourceTierMetadata]:
    try:
        from database.postgres import get_db_session

        async with get_db_session() as db:
            row = await db.fetchrow(
                """
                SELECT feed_id, nombre, tier, propaganda_risk,
                       state_affiliated, political_lean, reach_scope, country_origin
                FROM rss_feeds
                WHERE feed_id = $1
                  AND activo = TRUE
                LIMIT 1
                """,
                feed_id,
            )
            if row:
                return SourceTierMetadata(
                    feed_id=row["feed_id"],
                    nombre=row["nombre"],
                    tier=row["tier"],
                    propaganda_risk=float(row["propaganda_risk"]),
                    state_affiliated=bool(row["state_affiliated"]),
                    political_lean=row["political_lean"],
                    reach_scope=row["reach_scope"],
                    country_origin=row["country_origin"],
                )
    except Exception as e:
        logger.warning(f"DB lookup failed for source tier {feed_id}: {e}")
    return None


def build_source_context_block(metadata: Optional[SourceTierMetadata]) -> str:
    """
    Genera el bloque de texto METADATA DE LA FUENTE para inyectar en el prompt del LLM.
    Si no hay metadata, devuelve un bloque mínimo para no romper el análisis.
    """
    if not metadata:
        return ""

    tier_label = TIER_LABELS.get(metadata.tier, "Desconocido")
    lean_str = metadata.political_lean or "No determinada"
    affiliated_str = "Sí" if metadata.state_affiliated else "No"
    risk_pct = f"{metadata.propaganda_risk:.0%}"

    lines = [
        "METADATA DE LA FUENTE (usar para calibrar scoreDesin y orientacion_politica_estimada):",
        f"- Nombre: {metadata.nombre}",
        f"- Tier de credibilidad: {metadata.tier}/4 ({tier_label})",
        f"- Riesgo editorial: {risk_pct}",
        f"- Afiliación estatal: {affiliated_str}",
        f"- Orientación conocida: {lean_str}",
        f"- Alcance: {metadata.reach_scope} ({metadata.country_origin})",
        "",
        "Instrucción: Un artículo de Tier 1 parte con penalización base baja en scoreDesin.",
        "Un artículo de Tier 4 o con riesgo editorial >0.6 debe tener mayor escrutinio.",
    ]

    if metadata.state_affiliated:
        lines.append("⚠️  Medio con financiamiento estatal — evaluar posible agenda institucional.")

    if metadata.propaganda_risk >= 0.6:
        lines.append(f"⚠️  Alto riesgo editorial ({risk_pct}) — aplicar análisis crítico reforzado.")

    return "\n".join(lines)
