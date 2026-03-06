from agents.state import AgentState
from scraper.smart_scraper import SmartScraper

async def scraper_node(state: AgentState) -> AgentState:
    url = state["url"]
    scraper = SmartScraper()
    
    print(f"Scraping {url}...")
    result = await scraper.scrape(url)
    
    if result.get("status") == "failed":
        state["errors"].append(f"Scraping failed: {result.get('error')}")
    else:
        state["scraped_content"] = result
        state["steps_completed"].append("scraper")
        
    return state
