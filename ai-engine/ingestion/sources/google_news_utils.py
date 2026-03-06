from datetime import datetime
import email.utils
import feedparser
import urllib.parse

class GoogleNews:
    """
    Custom implementation of GoogleNews RSS wrapper to avoid dependency hell.
    Compatible with feedparser 6.x and Python 3.11.
    """
    BASE_URL = "https://news.google.com/rss"
    
    def __init__(self, country="ES", lang="es"):
        self.lang = lang.lower()
        self.country = country.upper()
        self.ceid = f"{self.country}:{self.lang}"
    
    def _build_url(self, path="", params=None):
        if params is None:
            params = {}
        defaults = {
            "hl": self.lang,
            "gl": self.country,
            "ceid": self.ceid
        }
        query_params = {**defaults, **params}
        encoded_params = urllib.parse.urlencode(query_params)
        return f"{self.BASE_URL}{path}?{encoded_params}"

    def top_news(self):
        url = self._build_url()
        return feedparser.parse(url)

    def search(self, query: str, when: str = None):
        q = query
        if when:
            q += f" when:{when}"
        
        url = self._build_url("/search", {"q": q})
        return feedparser.parse(url)

    def get_news_by_topic(self, topic: str):
        """Mocking the GNews library's get_news_by_topic using RSS sections."""
        url = self._build_url(f"/headlines/section/topic/{topic.upper()}")
        return feedparser.parse(url)
