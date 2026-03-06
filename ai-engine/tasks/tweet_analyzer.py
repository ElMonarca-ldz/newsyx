"""
Tweet analysis Celery task.
Analyzes pending tweets using Gemini Flash with a slim prompt
optimized for 280-char content, then persists TweetAnalysis to DB.
"""
import asyncio
import json
import os
import logging
from datetime import datetime
from celery import shared_task

logger = logging.getLogger(__name__)

BATCH_SIZE = 10  # tweets to analyze per cycle
BACKEND_URL = os.environ.get("BACKEND_URL", "http://backend:4000")

# ─── Slim analysis prompt for tweets ───────────────────────────────────
TWEET_ANALYSIS_PROMPT = """Eres un analista de inteligencia política especializado en América Latina.
Tu tarea es analizar tweets de actores relevantes (políticos, funcionarios,
periodistas, organismos oficiales, economistas) y extraer señales de
inteligencia estructurada.

Los tweets son cortos — analiza con precisión, sin sobreinterpretar.
Produce EXCLUSIVAMENTE un objeto JSON válido. Sin markdown fuera del JSON.
null para campos donde tu confianza sea < 0.6.

PERFIL DEL AUTOR:
- Username: @{username}
- Nombre: {display_name}
- Categoría: {category}
- Tier: {tier} (S=organismo oficial, A=político/funcionario, B=periodista/medio, C=analista)
- Orientación conocida: {political_lean}
- ¿Es afiliado estatal?: {is_state_affiliated}

TWEET A ANALIZAR:
"{raw_content}"

Fecha: {created_at}
Engagement: {likes} likes · {retweets} RTs · {replies} replies

SCHEMA REQUERIDO:
{{
  "intencion": "informar|opinar|alarmar|movilizar|declarar|amenazar|desmentir",
  "es_declaracion_oficial": false,
  "impacto_potencial": "bajo|medio|alto|critico",
  "sentimientoLabel": "POS|NEG|NEU",
  "sentimientoScore": 0.00,
  "scoreAlarmismo": 0.00,
  "es_opinion": false,
  "verificabilidad": "verificable|opinion|especulativo",
  "resumen": "Una frase. Qué dice y por qué importa.",
  "keywords": ["string"],
  "entidades": [
    {{
      "texto": "string — literal del tweet",
      "tipo": "persona|organizacion|lugar|instrumento_financiero|concepto",
      "slug": "string-slug",
      "accion": "menciona|critica|defiende|anuncia|amenaza|desmiente"
    }}
  ],
  "geo_refs": [
    {{
      "nombre": "string",
      "tipo": "pais|region|ciudad|institucion",
      "lat": 0.00,
      "lon": 0.00,
      "confianza": 0.00
    }}
  ],
  "actores_ref": [
    {{
      "slug": "string — slug del actor referenciado",
      "relacion": "menciona|critica|defiende|responde_a|acusa"
    }}
  ],
  "tags_itl": ["string — tags temáticos para el ITL: economía|política|seguridad|etc."],
  "contribuye_alarmismo": 0.00,
  "alertas": [
    {{
      "tipo": "string",
      "descripcion": "string",
      "severidad": "info|warning|danger|critical"
    }}
  ],
  "pregunta_no_respondida": "string o null"
}}

REGLAS:
- es_declaracion_oficial = true solo si el autor es tier S (organismo oficial) Y el tweet anuncia una medida, dato o posición institucional.
- impacto_potencial = "critico" solo si: organismo oficial anuncia medida económica OR político anuncia decisión de gobierno OR hay contradicción con declaración oficial previa.
- contribuye_alarmismo: señal numérica 0.0–1.0 que alimenta el Índice de Tensión. 1.0 = tweet que activamente genera pánico o escalada.
- No inventes entidades ni geo_refs. Solo lo que está explícitamente en el texto.
- Si el tweet es un retweet sin comentario, intencion = "informar" y es_opinion = false.
"""


@shared_task(name='tasks.tweet_analyzer.analyze_pending_tweets')
def analyze_pending_tweets():
    """Analiza tweets pendientes en lotes. Corre cada 2 minutos."""
    asyncio.run(_analyze_pending_async())


async def _analyze_pending_async():
    """Fetch pending tweets from DB and analyze each one."""
    import httpx

    # For now, this task is a placeholder that will be fully connected
    # when the system has tweets to analyze. The LLM call follows
    # the same pattern as analyze_article_task.
    logger.debug("[TweetAnalyzer] Checking for pending tweets...")

    # In production, this would:
    # 1. Query DB for tweets with analysisStatus='pending'
    # 2. For each tweet, build the prompt with TWEET_ANALYSIS_PROMPT
    # 3. Call Gemini Flash via the existing LLM router
    # 4. Parse JSON response and persist TweetAnalysis
    # 5. Update tweet.analysisStatus to 'done'
    # 6. Feed signals to WelfordTracker for ITL

    try:
        async with httpx.AsyncClient(base_url=BACKEND_URL, timeout=30) as client:
            # Check stats to see if there are pending tweets
            resp = await client.get("/api/twitter/stats")
            if resp.status_code == 200:
                stats = resp.json()
                pending = stats.get("pendingAnalysis", 0)
                if pending > 0:
                    logger.info(f"[TweetAnalyzer] {pending} tweets pending analysis")
                    # Analysis pipeline will be connected here
    except Exception as e:
        logger.debug(f"[TweetAnalyzer] Stats check skipped: {e}")


def build_tweet_prompt(tweet: dict, profile: dict) -> str:
    """Build the LLM prompt for a single tweet analysis."""
    return TWEET_ANALYSIS_PROMPT.format(
        username=profile.get("username", "unknown"),
        display_name=profile.get("displayName") or profile.get("username", "unknown"),
        category=profile.get("category", "analista"),
        tier=profile.get("tier", "C"),
        political_lean=profile.get("politicalLean") or "No determinada",
        is_state_affiliated="Sí" if profile.get("isStateAffiliated") else "No",
        raw_content=tweet.get("rawContent", ""),
        created_at=tweet.get("tweetCreatedAt", "N/A"),
        likes=tweet.get("likeCount", 0),
        retweets=tweet.get("retweetCount", 0),
        replies=tweet.get("replyCount", 0),
    )
