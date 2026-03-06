import spacy
import asyncio

_nlp = None

def get_spacy():
    global _nlp
    if _nlp is None:
        try:
            print("Loading Spacy model es_core_news_lg...")
            _nlp = spacy.load("es_core_news_lg")
        except OSError:
            print("Downloading Spacy model es_core_news_lg...")
            from spacy.cli import download
            download("es_core_news_lg")
            _nlp = spacy.load("es_core_news_lg")
    return _nlp

async def analyze_text_spacy(text: str):
    nlp = get_spacy()
    return await asyncio.to_thread(nlp, text)
