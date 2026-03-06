import trafilatura
import asyncio
from playwright.async_api import async_playwright
import logging

logger = logging.getLogger(__name__)

class SmartScraper:
    """
    Scraper inteligente con fallback:
    1. Trafilatura (rápido, HTTP)
    2. Playwright (lento, JS rendering)
    """

    def __init__(self):
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        }
        # Cookie de consentimiento universal de Google para evitar el "Before you continue"
        self.cookies = {
            "CONSENT": "YES+cb.20240116-07-p0.es+FX+999"
        }
    
    async def scrape(self, url: str) -> dict:
        # 1. Try Trafilatura (with session/cookies if possible, though trafilatura.fetch_url is limited)
        try:
            # Trafilatura fetch_url doesn't easily support cookies, but we'll try standard fetch
            downloaded = await asyncio.to_thread(trafilatura.fetch_url, url)
            
            # Simple check for consent wall or redirect in raw HTML
            consent_triggers = [
                "Before you continue to Google", 
                "Antes de continuar", 
                "Google Search, please click here",
                "si no se te redirecciona en unos segundos",
                "Haz clic aquí",
                "unusual traffic",
                "tráfico inusual",
                "nuestros sistemas han detectado",
                "un robot",
                "captcha"
            ]
            
            if downloaded:
                # Normalizar a minúsculas para una comparación más robusta
                html_lower = downloaded.lower() if isinstance(downloaded, str) else str(downloaded).lower()
                if any(trigger.lower() in html_lower for trigger in consent_triggers):
                    logger.info(f"Consent wall or redirect detected in raw HTML for {url}, skipping to Playwright")
                    downloaded = None

            if downloaded:
                result = trafilatura.extract(
                    downloaded, 
                    include_comments=False,
                    include_tables=True,
                    include_formatting=True,
                    output_format='markdown'
                )
                if result:
                    metadata = trafilatura.bare_extraction(downloaded)
                    title = metadata.title if hasattr(metadata, 'title') else metadata.get('title') if isinstance(metadata, dict) else None
                    author = metadata.author if hasattr(metadata, 'author') else metadata.get('author') if isinstance(metadata, dict) else None
                    date = metadata.date if hasattr(metadata, 'date') else metadata.get('date') if isinstance(metadata, dict) else None
                    
                    return {
                        "content": result,
                        "title": title,
                        "author": author,
                        "date": date,
                        "method": "trafilatura",
                        "status": "success"
                    }
        except Exception as e:
            logger.warning(f"Trafilatura failed for {url}: {e}")
            
        # 2. Fallback to Playwright with Consent Bypass
        logger.info(f"Falling back to Playwright for {url} with consent wall handling")
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                # Inyectar cookies de Google a nivel de contexto
                context = await browser.new_context(
                    user_agent=self.headers["User-Agent"],
                    extra_http_headers={"Accept-Language": self.headers["Accept-Language"]}
                )
                
                # Inject Google-specific consent cookies for the main domain
                if "google" in url:
                    await context.add_cookies([
                        {
                            "name": "CONSENT", 
                            "value": "YES+cb.20240116-07-p0.es+FX+999", 
                            "domain": ".google.com", 
                            "path": "/"
                        },
                        {
                            "name": "SOCS",
                            "value": "CAISHAgBEhJnd3NfMjAyNDA0MTUtMF9SQzIaAmVzIAEaBgiA_LmwBg",
                            "domain": ".google.com",
                            "path": "/"
                        }
                    ])

                page = await context.new_page()
                try:
                    # Increase timeout for the initial load
                    await page.goto(url, timeout=60000, wait_until="commit")
                    
                    # Robust consent bypass: click until gone or timeout
                    consent_selectors = [
                        "button:has-text('Aceptar todo')",
                        "button:has-text('Accept all')",
                        "button:has-text('Acepto')",
                        "button:has-text('I agree')",
                        "button:has-text('AGREE')",
                        "button:has-text('Personalizar')",
                        "button:has-text('Customize')",
                        "button[aria-label*='Accept all']",
                        "button[aria-label*='Aceptar todo']",
                        "button[aria-label*='Acepto']",
                        "#L2AGLb",
                        "form[action*='consent.google.com'] button",
                        "button.VfPpkd-LgbsSe",
                        "button.tHlp8d", # Common class for Google buttons
                        "#didomi-notice-agree-button",
                        ".fc-cta-consent",
                        "button[onclick*='accept']"
                    ]
                    
                    # More aggressive loop for consent bypass
                    start_time = asyncio.get_event_loop().time()
                    while asyncio.get_event_loop().time() - start_time < 15:
                        clicked = False
                        # Check if we are stuck in the language selection list
                        if "consent.google.com" in page.url and await page.locator("ul[role='listbox']").is_visible(timeout=500):
                            logger.info("Language selection list detected, trying to find accept/continue button")
                            # Try to find any button that might bypass this
                            alt_button = await page.locator("button:has-text('Español'), button:has-text('Continuar')").first
                            if await alt_button.is_visible():
                                await alt_button.click()
                                await page.wait_for_timeout(1000)
                                clicked = True

                        for selector in consent_selectors:
                            try:
                                button = await page.locator(selector).first
                                if await button.is_visible(timeout=500):
                                    logger.info(f"Consent button detected ({selector}), clicking...")
                                    await button.click()
                                    await page.wait_for_timeout(1000) # Small wait after click
                                    clicked = True
                                    break
                            except:
                                continue
                        
                        # Check if we are still on a google consent page
                        current_url = page.url
                        if "consent.google.com" not in current_url and not clicked:
                            break
                        if clicked:
                            # Verify if navigation happened
                            try:
                                await page.wait_for_load_state("networkidle", timeout=3000)
                            except:
                                pass
                        else:
                            await page.wait_for_timeout(500)

                    # Wait for redirects and content
                    if "google.com" in url:
                        try:
                            # More specific check: ensure we are NOT on a language selection list
                            await page.wait_for_function(
                                """() => {
                                    const hostname = window.location.hostname;
                                    const isGoogle = hostname.includes('google.com');
                                    const hasArticle = document.querySelector('article, .article, h1:not(:empty)');
                                    const isLanguageSelection = document.body.innerText.includes('EnglishUnited States') && document.body.innerText.includes('català');
                                    return (!isGoogle || hasArticle) && !isLanguageSelection;
                                }""",
                                timeout=20000
                            )
                        except:
                            pass
                    
                    # Final wait for stability
                    try:
                        await page.wait_for_load_state("networkidle", timeout=5000)
                    except:
                        pass
                        
                    content = await page.content()
                    
                    # Use trafilatura on the rendered content
                    result = trafilatura.extract(
                        content,
                        include_formatting=True,
                        output_format='markdown',
                        include_comments=False,
                        include_tables=True,
                        no_fallback=False
                    )
                    
                    # Fallback: if result is too short, maybe trafilatura didn't like the rendered JS/DOM
                    # Try raw download as fallback
                    if not result or len(result) < 500:
                        logger.info(f"Rendered extraction too short ({len(result) if result else 0}), trying raw fallback")
                        raw_download = await asyncio.to_thread(trafilatura.fetch_url, url)
                        if raw_download:
                            raw_result = trafilatura.extract(raw_download, output_format='markdown')
                            if raw_result and len(raw_result) > (len(result) if result else 0):
                                result = raw_result
                                logger.info("Using raw fallback result")

                    if result:
                        # Strict validation: Check for consent wall or error page indicators in the EXTRACTED text
                        failure_indicators = [
                            "Before you continue to Google",
                            "Antes de continuar a Google",
                            "EnglishUnitedStates", # Indicator of the language list
                            "Todos los idiomas",
                            "choose your language",
                            "nuestros sistemas han detectado tráfico inusual",
                            "unusual traffic from your computer",
                            "400. That's an error",
                            "400. Se ha producido un error",
                            "Es toda la información de la que disponemos",
                            "That’s all we know"
                        ]
                        
                        if any(indicator.lower() in result.lower() for indicator in failure_indicators):
                            logger.error(f"Extracted content is a consent wall or error page for {url}")
                            return {"status": "failed", "error": "Google blocked access (Consent/Error page detected)"}

                        metadata = trafilatura.bare_extraction(content)
                        title = metadata.title if hasattr(metadata, 'title') else metadata.get('title') if isinstance(metadata, dict) else None
                        
                        return {
                            "content": result,
                            "title": title,
                            "method": "playwright",
                            "status": "success",
                            "final_url": page.url
                        }
                    return {"status": "failed", "error": "Could not extract content"}
                finally:
                    await browser.close()
        except Exception as e:
            logger.error(f"Playwright failed for {url}: {e}")
            return {"status": "failed", "error": str(e)}
