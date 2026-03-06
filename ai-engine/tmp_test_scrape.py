import asyncio
from scraper.smart_scraper import SmartScraper

async def test():
    scraper = SmartScraper()
    url = "https://elpais.com/internacional/2024-03-01/el-ejercito-israeli-dispara-contra-una-multitud-que-esperaba-ayuda-humanitaria-en-gaza.html"
    print(f"Testing scraper for {url}...")
    result = await scraper.scrape(url)
    if result.get("status") == "success":
        print("\n--- CONTENT PREVIEW (MARKDOWN) ---")
        print(result["content"][:1000])
        print("\n--- END PREVIEW ---")
    else:
        print(f"Error: {result.get('error')}")

if __name__ == "__main__":
    import sys
    import os
    # Add project root to path
    sys.path.append(os.getcwd())
    asyncio.run(test())
