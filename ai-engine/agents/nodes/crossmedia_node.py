from agents.state import AgentState
from llm.openrouter_client import OpenRouterClient
from prompts.analysis_prompts import CROSSMEDIA_COMPARISON_PROMPT
from typing import List, Optional
from pydantic import BaseModel

class CrossMediaOutput(BaseModel):
    diferencias_principales: List[str]
    consensus_narrativo: str
    outlier_narrativo: bool
    medio_mas_completo: Optional[str] = None
    angulos_exclusivos: List[dict]
    score_validacion: float # 0.0 (totalmente contradictorio) a 1.0 (respalado total)

async def crossmedia_node(state: AgentState) -> AgentState:
    search_results = state.get("search_results", [])
    if not search_results:
        return state

    print("Running Cross-Media analysis...")
    
    # Prepare context from search results
    context_str = ""
    for i, res in enumerate(search_results):
        context_str += f"MEDIO {i+1} ({res.get('url')}):\n{res.get('content', '')[:2000]}\n\n"
        
    client = OpenRouterClient()
    
    try:
        result = await client.complete_structured(
            system_prompt=CROSSMEDIA_COMPARISON_PROMPT,
            user_content=f"NOTICIA ORIGINAL:\n{state.get('scraped_content', {}).get('titular')}\n\nCOBERTURA EN OTROS MEDIOS:\n{context_str}",
            output_schema=CrossMediaOutput
        )
        
        state["crossmedia_analysis"] = result.model_dump()
        state["steps_completed"].append("crossmedia")

    except Exception as e:
        state["errors"].append(f"Cross-media analysis failed: {e}")
        
    return state
