from agents.state import AgentState
from llm.router import LLMRouter
from prompts.analysis_prompts import get_analysis_prompt
from schemas.llm_outputs import FullAnalysisOutput
from utils.source_metadata import get_source_metadata, build_source_context_block
from utils.geo_utils import get_geo_normalizer

async def llm_analysis_node(state: AgentState) -> AgentState:
    text = state.get("scraped_content", {}).get("content", "")
    if not text:
        return state

    print("Running LLM analysis (v3.0) with Router...")
    client = LLMRouter()
    
    # Extract metadata for structured user content
    raw = state.get("raw_article_data", {})
    scraped = state.get("scraped_content", {})
    titular = scraped.get("title") or raw.get("titular") or raw.get("title") or "Sin título"
    fuente = raw.get("fuente") or raw.get("source_name") or "Desconocida"
    fecha = raw.get("fecha_publicacion") or raw.get("published") or "No disponible"
    feed_id = raw.get("source_feed_id")

    # A1 · Obtener metadata de tier de la fuente (Redis cache → DB → None)
    source_metadata = await get_source_metadata(feed_id) if feed_id else None
    source_context_block = build_source_context_block(source_metadata)

    if source_metadata:
        print(f"  Source tier: {source_metadata.tier}/4 ({source_metadata.nombre}), risk: {source_metadata.propaganda_risk:.0%}")
    
    # Truncate text if too long (v3 needs more context for richer analysis)
    truncated_text = text[:20000]
    
    # Build user content — source metadata block first, then article body
    parts = []
    if source_context_block:
        parts.append(source_context_block)
        parts.append("")  # blank line separator
    parts.extend([
        f"TITULAR: {titular}",
        f"FUENTE: {fuente}",
        f"FECHA: {fecha}",
        "CUERPO:",
        truncated_text,
    ])
    user_content = "\n".join(parts)
    
    try:
        system_prompt = await get_analysis_prompt()
        result = await client.complete_structured(
            system_prompt=system_prompt,
            user_content=user_content,
            output_schema=FullAnalysisOutput,
            max_tokens=12288
        )
        
        # A2 · Normalización Geográfica (CABA, Provincias, Coordenadas)
        if result and result.geo_intelligence:
            geo_normalizer = get_geo_normalizer()
            result.geo_intelligence = geo_normalizer.normalize(result.geo_intelligence.model_dump())
            # Convert back to dict if needed for state, or re-validate if using model
            state["llm_output"] = result.model_dump()
        else:
            state["llm_output"] = result.model_dump()

        # Store tier metadata in state for potential downstream use (e.g., persistence node)
        if source_metadata:
            state["source_tier_metadata"] = {
                "tier": source_metadata.tier,
                "propaganda_risk": source_metadata.propaganda_risk,
                "state_affiliated": source_metadata.state_affiliated,
                "political_lean": source_metadata.political_lean,
            }
        state["steps_completed"].append("llm_analysis")

    except Exception as e:
        print(f"LLM analysis failed: {e}")
        state["errors"].append(f"LLM analysis failed: {e}")
        
    return state
