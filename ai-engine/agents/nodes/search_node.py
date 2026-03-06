from agents.state import AgentState
from tavily import TavilyClient
import os
import asyncio

async def search_node(state: AgentState) -> AgentState:
    query = state.get("scraped_content", {}).get("titular")
    if not query:
        return state

    print(f"Searching for context: {query}")
    api_key = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        state["errors"].append("Missing TAVILY_API_KEY")
        return state
        
    try:
        tavily = TavilyClient(api_key=api_key)
        # Search for context and other perspectives
        response = await asyncio.to_thread(
            tavily.search,
            query=query,
            search_depth="advanced",
            include_answer=False,
            max_results=5
        )
        
        state["search_results"] = response.get("results", [])
        state["steps_completed"].append("search")
        
    except Exception as e:
        state["errors"].append(f"Search failed: {e}")
        
    return state
