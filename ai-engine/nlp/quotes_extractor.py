from .spacy_pipeline import get_spacy

def extract_quotes(text: str):
    """
    Extracts verification quotes using Spacy.
    Looks for verbs of speech.
    """
    nlp = get_spacy()
    doc = nlp(text)
    quotes = []
    
    # Simple heuristic: text in quotes
    # Improved logic would use dependency parsing to find subject of "dijo", "señaló", etc.
    
    import re
    # Regex for "..." or «...»
    matches = re.finditer(r'["«]([^"»]+)["»]', text)
    for m in matches:
        quotes.append({
            "text": m.group(1),
            "speaker": "Unknown", # logic to find speaker
            "verified": False
        })
        
    return quotes
