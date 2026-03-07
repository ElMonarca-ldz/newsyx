import os
from google import genai
from google.genai import types
from typing import TypeVar, Type
from pydantic import BaseModel
import json
import logging
from utils.circuit_breaker import RedisCircuitBreaker

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

class GoogleGeminiClient:
    def __init__(self):
        self.api_key = os.environ.get("GOOGLE_API_KEY")
        self.model_name = os.environ.get("GOOGLE_MODEL", "gemini-2.0-flash")
        
        # New SDK uses a client instance
        self.client = None
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            logger.warning("GOOGLE_API_KEY not set")
            
        self.circuit_breaker = RedisCircuitBreaker(
            name="gemini",
            failure_threshold=3,
            recovery_timeout=60 # Recovery in 1 minute to maximize freetier reuse
        )

    def is_healthy(self) -> bool:
        """Check if client is considered healthy by the circuit breaker."""
        return not self.circuit_breaker.is_open()

    async def complete_structured(
        self,
        system_prompt: str,
        user_content: str,
        output_schema: Type[T],
        temperature: float = 0.1,
        max_tokens: int = 8192
    ) -> T:
        """Wrapper that uses the circuit breaker."""
        return await self.circuit_breaker(
            self._complete_structured_impl,
            system_prompt,
            user_content,
            output_schema,
            temperature,
            max_tokens
        )

    async def _get_config(self):
        """Fetch dynamic configuration from database with environment fallback."""
        from database.postgres import get_db_session
        
        db_api_key = None
        db_model = None

        try:
            async with get_db_session() as conn:
                rows = await conn.fetch("SELECT key, value FROM system_configs WHERE key IN ('GOOGLE_API_KEY', 'GOOGLE_MODEL')")
                config = {row['key']: row['value'] for row in rows}
                db_api_key = config.get('GOOGLE_API_KEY')
                db_model = config.get('GOOGLE_MODEL')
        except Exception:
            pass

        api_key = db_api_key or self.api_key
        model = db_model or self.model_name
        
        # Clean model name (v2 SDK doesn't strictly need models/ prefix but it's safe)
        if model and model.startswith("models/"):
            model = model.replace("models/", "")
            
        return api_key, model

    async def _complete_structured_impl(
        self,
        system_prompt: str,
        user_content: str,
        output_schema: Type[T],
        temperature: float = 0.1,
        max_tokens: int = 8192
    ) -> T:
        api_key, model_name = await self._get_config()
        
        if not api_key:
            raise Exception("GOOGLE_API_KEY is missing")

        # Use the specific API key from config if available, otherwise fallback to initial client
        client = genai.Client(api_key=api_key) if api_key != self.api_key else self.client
        if not client:
             client = genai.Client(api_key=api_key)

        # Simplified V2 implementation: The SDK now handles Pydantic models directly!
        # No more manual schema flattening required.
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=user_content,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=temperature,
                    max_output_tokens=max_tokens,
                    response_mime_type="application/json",
                    response_schema=output_schema,
                ),
            )
            
            if not response.text:
                raise Exception("Gemini returned empty response")
                
            return output_schema.model_validate_json(response.text)
        except Exception as e:
            logger.error(f"Gemini V2 API error: {e}")
            raise
