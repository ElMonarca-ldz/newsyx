import asyncio

try:
    from keybert import KeyBERT
    HAS_KEYBERT = True
except ImportError:
    HAS_KEYBERT = False
    KeyBERT = None

_kw_model = None

def get_kw_model():
    global _kw_model
    if not HAS_KEYBERT:
        return None
    if _kw_model is None:
        try:
            _kw_model = KeyBERT("paraphrase-multilingual-MiniLM-L12-v2")
        except Exception:
            _kw_model = None
    return _kw_model

async def extract_keywords(text: str, top_n: int = 5):
    if not HAS_KEYBERT:
        # Fallback to basic word splitting or empty list
        return []
        
    kw_model = get_kw_model()
    if kw_model is None:
        return []
        
    keywords = await asyncio.to_thread(
        kw_model.extract_keywords, 
        text, 
        keyphrase_ngram_range=(1, 2), 
        stop_words='english', # Should be spanish but library might default
        top_n=top_n
    )
    # Filter/clean if needed
    return keywords
