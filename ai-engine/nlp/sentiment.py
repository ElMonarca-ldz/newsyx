try:
    from pysentimiento import create_analyzer
except ImportError:
    create_analyzer = None

import asyncio

_sentiment_analyzer = None
_emotion_analyzer = None

class DummyResult:
    def __init__(self):
        self.output = "NEUTRAL"
        self.probas = {"NEU": 1.0}

class DummyAnalyzer:
    def predict(self, text):
        return DummyResult()

def get_sentiment_analyzer():
    global _sentiment_analyzer
    if _sentiment_analyzer is None:
        if create_analyzer:
            _sentiment_analyzer = create_analyzer(task="sentiment", lang="es")
        else:
            _sentiment_analyzer = DummyAnalyzer()
    return _sentiment_analyzer

def get_emotion_analyzer():
    global _emotion_analyzer
    if _emotion_analyzer is None:
        if create_analyzer:
            _emotion_analyzer = create_analyzer(task="emotion", lang="es")
        else:
            _emotion_analyzer = DummyAnalyzer()
    return _emotion_analyzer

async def analyze_sentiment(text: str):
    analyzer = get_sentiment_analyzer()
    return await asyncio.to_thread(analyzer.predict, text)

async def analyze_emotions(text: str):
    analyzer = get_emotion_analyzer()
    return await asyncio.to_thread(analyzer.predict, text)
