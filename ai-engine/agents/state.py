from typing import TypedDict, List, Dict, Any, Optional
from schemas.news_analysis import NewsAnalysis

class AgentState(TypedDict):
    url: str
    raw_article_data: Dict[str, Any]
    
    # Intermediate data
    scraped_content: Optional[dict]
    nlp_results: Optional[dict]
    llm_output: Optional[dict]
    search_results: Optional[List[dict]]
    crossmedia_analysis: Optional[dict]
    final_output: Optional[dict]
    
    # Status tracking
    errors: List[str]
    steps_completed: List[str]
