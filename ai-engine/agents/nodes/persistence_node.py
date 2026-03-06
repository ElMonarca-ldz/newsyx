import json
import hashlib
import logging
import re
import unicodedata
from datetime import datetime
from agents.state import AgentState
from database.postgres import get_db_session

logger = logging.getLogger(__name__)

def _compute_url_hash(url: str) -> str:
    return hashlib.md5(url.encode("utf-8")).hexdigest()

def _compute_title_hash(title: str) -> str:
    if not title:
        return ""
    # Normalize: lowercase, strip punctuation and extra spaces
    normalized = unicodedata.normalize('NFKD', title).encode('ascii', 'ignore').decode('ascii')
    normalized = re.sub(r'[^\w\s]', '', normalized).lower()
    normalized = re.sub(r'\s+', ' ', normalized).strip()
    return hashlib.md5(normalized.encode("utf-8")).hexdigest()

def _slugify(text: str) -> str:
    if not text:
        return "sin-titulo"
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')
    text = re.sub(r'[^\w\s-]', '', text).lower()
    return re.sub(r'[-\s]+', '-', text).strip('-')

async def persistence_node(state: AgentState) -> AgentState:
    """
    v3.0 persistence node — persists analysis results to PostgreSQL.
    Extracts v3 fields (emociones, keywords, scores, esOpinion, ui_enrichment)
    and stores them in the analysis_data JSONB column.
    """
    url = state.get("url", "")
    if not url:
        logger.warning("No URL in state, skipping persistence")
        return state

    logger.info(f"Persisting analysis for: {url}")

    final_output = state.get("final_output") or {}
    nlp = state.get("nlp_results") or {}
    scraped = state.get("scraped_content") or {}
    raw = state.get("raw_article_data") or {}
    errors = state.get("errors") or []

    # Compute URL hash locally
    url_hash = _compute_url_hash(url)
    
    # Extract data for DB columns
    titular = scraped.get("title") or raw.get("titular") or raw.get("title") or "Sin título"
    title_hash = _compute_title_hash(titular)
    fuente = raw.get("fuente") or raw.get("source_name") or "Desconocida"
    dominio = raw.get("dominio") or raw.get("domain") or "desconocido.com"
    cuerpo = scraped.get("content") or ""
    source_type = raw.get("source_type")
    source_feed_id = raw.get("source_feed_id")

    # Generate slug: fuente-slug/titulo-slug
    fuente_slug = _slugify(fuente)
    titulo_slug = _slugify(titular)
    slug = f"{fuente_slug}/{titulo_slug}"

    # Extract categoria
    categoria = final_output.get("categoria_principal")

    # v3: Extract sentiment from LLM output (preferred) or NLP fallback
    sentiment_label = final_output.get("sentimientoLabel") or nlp.get("sentiment")
    sentiment_score = final_output.get("sentimientoScore")
    if sentiment_score is None:
        sentiment_score_probas = nlp.get("sentiment_score", {})
        sentiment_score = 0.0
        if sentiment_label and isinstance(sentiment_score_probas, dict):
            sentiment_score = float(sentiment_score_probas.get(sentiment_label, 0.0))

    # v3: Extract framing and opinion flag
    framing_principal = final_output.get("framing", {}).get("enfoque_predominante")
    es_opinion = final_output.get("esOpinion", False)
    sesgo_politico = final_output.get("sesgo", {}).get("orientacion_politica_estimada")
    sesgo_confianza = final_output.get("sesgo", {}).get("confianza_orientacion")

    # v3: Extract emociones and keywords from LLM output (preferred) or NLP fallback
    emociones = final_output.get("emociones") or nlp.get("emotions", {})
    keywords_raw = final_output.get("keywords") or nlp.get("keywords", [])
    keywords = [k[0] if isinstance(k, (list, tuple)) else k for k in keywords_raw]

    # Scores from final_output
    scores = final_output.get("scores_finales", {})

    # Status - COMPLETED only if we have output without errors
    status = "COMPLETED" if final_output else "FAILED"
    if errors:
        status = "FAILED"

    # Build the full JSON blob to store in analysis_data (JSONB)
    # Include all v3 analysis data + ui_enrichment for the frontend
    analysis_data = {
        **{k: v for k, v in final_output.items() if k not in ("scores_finales",)},
        "cuerpo": final_output.get("cuerpo_procesado") or cuerpo,
        "emociones": emociones,
        "keywords": keywords,
        "nlp_full": nlp,
        "pipeline_errors": errors,
    }

    # v2: Extract geo_intelligence and temporal_intelligence for dedicated columns
    geo_intelligence_json = final_output.get("geo_intelligence")
    temporal_intelligence_json = final_output.get("temporal_intelligence")

    logger.info(f"Acquiring DB session for {url}")
    try:
        async with get_db_session() as db:
            logger.info(f"Executing INSERT for {url} (status={status})")
            await db.execute("""
                INSERT INTO news_analysis (
                    id, url_hash, url, titular, fuente, dominio,
                    sentimiento_label, sentimiento_score,
                    sesgo_politico, sesgo_confianza,
                    framing_principal, es_opinion,
                    score_global, score_calidad, score_desinformacion,
                    score_sesgo, score_clickbait,
                    status, analysis_data, fecha_extraccion, updated_at,
                    source_type, source_feed_id,
                    geo_intelligence, temporal_intelligence, slug, imagen_url, categoria, title_hash
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5,
                    $6, $7, $8, $9, $10, $11,
                    $12, $13, $14, $15, $16,
                    $17, $18, $19, $20,
                    $21, $22,
                    $23, $24, $25, $26, $27, $28
                )
                ON CONFLICT (url_hash) DO UPDATE SET
                    titular = EXCLUDED.titular,
                    fuente = EXCLUDED.fuente,
                    dominio = EXCLUDED.dominio,
                    sentimiento_label = EXCLUDED.sentimiento_label,
                    sentimiento_score = EXCLUDED.sentimiento_score,
                    sesgo_politico = EXCLUDED.sesgo_politico,
                    sesgo_confianza = EXCLUDED.sesgo_confianza,
                    framing_principal = EXCLUDED.framing_principal,
                    es_opinion = EXCLUDED.es_opinion,
                    score_global = EXCLUDED.score_global,
                    score_calidad = EXCLUDED.score_calidad,
                    score_desinformacion = EXCLUDED.score_desinformacion,
                    score_sesgo = EXCLUDED.score_sesgo,
                    score_clickbait = EXCLUDED.score_clickbait,
                    status = EXCLUDED.status,
                    analysis_data = EXCLUDED.analysis_data,
                    fecha_extraccion = EXCLUDED.fecha_extraccion,
                    updated_at = EXCLUDED.updated_at,
                    source_type = EXCLUDED.source_type,
                    source_feed_id = EXCLUDED.source_feed_id,
                    geo_intelligence = EXCLUDED.geo_intelligence,
                    temporal_intelligence = EXCLUDED.temporal_intelligence,
                    imagen_url = EXCLUDED.imagen_url,
                    categoria = EXCLUDED.categoria,
                    title_hash = EXCLUDED.title_hash
            """,
            url_hash, url, titular, fuente, dominio,
            sentiment_label, sentiment_score,
            sesgo_politico, sesgo_confianza,
            framing_principal, es_opinion,
            scores.get("score_global"), scores.get("score_calidad"), scores.get("score_desinformacion"),
            scores.get("score_sesgo"), scores.get("score_clickbait"),
            status, json.dumps(analysis_data, default=str, ensure_ascii=False), datetime.utcnow(), datetime.utcnow(),
            source_type, source_feed_id,
            json.dumps(geo_intelligence_json, default=str, ensure_ascii=False) if geo_intelligence_json else None,
            json.dumps(temporal_intelligence_json, default=str, ensure_ascii=False) if temporal_intelligence_json else None,
            slug,
            raw.get("imagen_preview"),
            categoria,
            title_hash
            )
            logger.info(f"Successfully persisted analysis for {url} (status={status})")
            state["steps_completed"].append("persistence")
    except Exception as e:
        logger.error(f"Failed to persist analysis for {url}: {e}", exc_info=True)
        state["errors"].append(f"Persistence error: {str(e)}")

    return state
