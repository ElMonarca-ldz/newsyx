import asyncio
import sys
import os
import trafilatura
from playwright.async_api import async_playwright

# Add ai-engine to path
sys.path.append(os.path.abspath("ai-engine"))

from scraper.smart_scraper import SmartScraper

async def debug_url(url, index):
    scraper = SmartScraper()
    print(f"\n--- Debugging URL {index}: {url} ---")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Use a fresh context for each to see if it makes a difference
        context = await browser.new_context(
            user_agent=scraper.headers["User-Agent"],
            extra_http_headers={"Accept-Language": scraper.headers["Accept-Language"]}
        )
        
        page = await context.new_page()
        
        try:
            print("Navigating...")
            await page.goto(url, wait_until="commit", timeout=60000)
            
            # Wait a few seconds for potential consent
            await asyncio.sleep(3)
            
            # Capture state BEFORE bypass
            await page.screenshot(path=f"debug_before_{index}.png")
            content_before = await page.content()
            with open(f"debug_before_{index}.html", "w", encoding="utf-8") as f:
                f.write(content_before)
            
            print("Running scraper logic...")
            result = await scraper.scrape(url)
            
            # Capture state AFTER bypass
            # Need a new page to see what scraper did, or just trust scraper result
            print(f"Scraper result status: {result.get('status')}")
            if result.get("status") == "success":
                print(f"Content length: {len(result['content'])}")
                print(f"Content snippet: {result['content'][:200]}...")
            else:
                print(f"Error: {result.get('error')}")
                
        except Exception as e:
            print(f"Debug failed for {url}: {e}")
        finally:
            await browser.close()

async def main():
    # Example problematic URLs (representative of Google News redirects)
    urls = [
        "https://news.google.com/rss/articles/CBMi4gFBVV95cUxQckp6TTA4OFFrX1AtOVdhT1R3djMzLTc1dWdWaW9hdHUybXR1dUFBUkhEUDBzNEU4NXlsLXBwaTFERS1aT1VDeU5uelJIMGR2aEp1VXlPb0dOeUJxOWFwVlFNb3RQWFJiVTY4U3dwZGlJOXU5dGhEQi1JUEZLVnh6eE55dWJDMmZ6Rm9yUUlDLVlyOHg5djZjalZ2elMxcnZsa2RoY25URjAyb2h6ZUJraWxwdXRtb2lSMVBiNzVfLVgtNWJ6V0dCYXFVbjlrVjF1T2gwRDU5ZHpISEVFNElYX01R?oc=5",
        "https://news.google.com/rss/articles/CBMidWh0dHBzOi8vd3d3LmVsZGViYXRlLmNvbS9lc3BhbmEvMjAyNjAzMDIvbGFpbmV6LWV4cGxpY2EtcG9ycXVlLW9idmFkb3Itbm8tcHVlZGUtc2VyLWRlcG9ydGFkby1lc3BhbmFfNDAwMTE1Lmh0bWzSAXdodHRwczovL3d3dy5lbGRlYmF0ZS5jb20vZXNwYW5hLzIwMjYwMzAyL2xhaW5lei1leHBsaWNhLXBvcnF1ZS1vYnZhZG9yLW5vLXB1ZWRlLXNlci1kZXBvcnRhZG8tZXNwYW5hXzQwMDExNV9hbXAuaHRtbA?oc=5"
    ]
    
    for i, url in enumerate(urls):
        await debug_url(url, i)

if __name__ == "__main__":
    asyncio.run(main())
