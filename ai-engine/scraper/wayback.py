import requests
import asyncio

class WaybackMachine:
    """
    Check availability in Wayback Machine.
    """
    API_URL = "http://archive.org/wayback/available"
    
    async def check_availability(self, url: str):
        try:
            params = {"url": url}
            response = await asyncio.to_thread(requests.get, self.API_URL, params=params)
            data = response.json()
            if "archived_snapshots" in data and "closest" in data["archived_snapshots"]:
                 return data["archived_snapshots"]["closest"]
            return None
        except Exception:
            return None
