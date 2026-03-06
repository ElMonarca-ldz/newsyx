from agents.state import AgentState
from nlp.spacy_pipeline import analyze_text_spacy
from nlp.sentiment import analyze_sentiment, analyze_emotions
from nlp.keywords import extract_keywords
# from nlp.readability import calculate_readability
# from nlp.quotes_extractor import extract_quotes

async def nlp_node(state: AgentState) -> AgentState:
    if not state.get("scraped_content"):
        return state
        
    text = state["scraped_content"].get("content", "")
    if not text:
        state["errors"].append("No text content for NLP")
        return state

    print("Running NLP pipeline...")
    
    # Run in parallel? For simplicity sequential for now allowing internal parallelism
    # doc = await analyze_text_spacy(text) # Just verify it works
    
    sentiment = await analyze_sentiment(text)
    emotions = await analyze_emotions(text)
    keywords = await extract_keywords(text)
    
    state["nlp_results"] = {
        "sentiment": sentiment.output,
        "sentiment_score": sentiment.probas,
        "emotions": emotions.probas,
        "keywords": keywords
    }
    state["steps_completed"].append("nlp")
    
    return state
