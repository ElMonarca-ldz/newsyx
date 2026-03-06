from langgraph.graph import StateGraph, END
from agents.state import AgentState
from agents.nodes.scraper_node import scraper_node
from agents.nodes.nlp_node import nlp_node
from agents.nodes.llm_analysis_node import llm_analysis_node
from agents.nodes.search_node import search_node
from agents.nodes.crossmedia_node import crossmedia_node
from agents.nodes.scoring_node import scoring_node
from agents.nodes.persistence_node import persistence_node
from datetime import datetime
import os

def create_agent_graph():
    builder = StateGraph(AgentState)
    
    # Add nodes
    builder.add_node("scraper", scraper_node)
    builder.add_node("nlp", nlp_node)
    builder.add_node("llm_analysis", llm_analysis_node)
    builder.add_node("search", search_node)
    builder.add_node("crossmedia", crossmedia_node)
    builder.add_node("scoring", scoring_node)
    builder.add_node("persistence", persistence_node)
    
    # Define edges
    builder.set_entry_point("scraper")
    
    builder.add_edge("scraper", "nlp")
    builder.add_edge("nlp", "llm_analysis")
    
    # Conditional branching:
    # If crossmedia enabled, go to search -> crossmedia -> scoring
    # Else go directly to scoring
    
    def route_after_llm(state: AgentState):
        if os.environ.get("ENABLE_CROSSMEDIA_SEARCH") == "true":
            return "search"
        return "scoring"
        
    builder.add_conditional_edges(
        "llm_analysis",
        route_after_llm,
        {
            "search": "search",
            "scoring": "scoring"
        }
    )
    
    builder.add_edge("search", "crossmedia")
    builder.add_edge("crossmedia", "scoring")
    builder.add_edge("scoring", "persistence")
    builder.add_edge("persistence", END)
    
    return builder.compile()

# Singleton graph
_agent_graph = None

def get_agent_graph():
    global _agent_graph
    if _agent_graph is None:
        _agent_graph = create_agent_graph()
    return _agent_graph

async def analyze_article(url: str, raw_article_data: dict) -> dict:
    graph = get_agent_graph()
    
    initial_state = AgentState(
        url=url,
        raw_article_data=raw_article_data,
        scraped_content=None,
        nlp_results=None,
        llm_output=None,
        search_results=None,
        crossmedia_analysis=None,
        final_output=None,
        errors=[],
        steps_completed=[]
    )
    
    # Run the graph
    print(f"Starting analysis for {url}")
    final_state = await graph.ainvoke(initial_state)
    
    return final_state

async def analyze_article_stream(url: str, raw_article_data: dict):
    """
    Generator that yields state updates as the graph executes.
    """
    graph = get_agent_graph()
    
    initial_state = AgentState(
        url=url,
        raw_article_data=raw_article_data,
        scraped_content=None,
        nlp_results=None,
        llm_output=None,
        search_results=None,
        crossmedia_analysis=None,
        final_output=None,
        errors=[],
        steps_completed=[]
    )
    
    async for event in graph.astream(initial_state):
        # LangGraph returns a dict where keys are node names and values are the NEW state delta
        for node_name, state_delta in event.items():
            yield {
                "step": node_name,
                "data": state_delta,
                "timestamp": datetime.now().isoformat()
            }
