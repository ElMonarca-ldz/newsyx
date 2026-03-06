import os
import httpx
from typing import TypeVar, Type
from pydantic import BaseModel

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "google/gemini-flash-2.5")

T = TypeVar("T", bound=BaseModel)

class OpenRouterClient:
    def __init__(self):
        self.api_key = os.environ.get("OPENROUTER_API_KEY")
        if not self.api_key:
             # Just a warning or placeholder, to allow init without key for testing
             print("Warning: OPENROUTER_API_KEY not set")

        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": os.environ.get("APP_URL", "http://localhost:3000"),
            "X-Title": "Newsyx",
            "Content-Type": "application/json"
        }
        
        from utils.circuit_breaker import RedisCircuitBreaker
        import httpx
        self.circuit_breaker = RedisCircuitBreaker(
            name="openrouter",
            failure_threshold=3,
            recovery_timeout=600, # 10 minutes for enterprise robustness
            expected_exceptions=(httpx.RequestError, httpx.HTTPStatusError)
        )

    def is_healthy(self) -> bool:
        """Check if OpenRouter is considered healthy by the circuit breaker."""
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
                rows = await conn.fetch("SELECT key, value FROM system_configs WHERE key IN ('OPENROUTER_API_KEY', 'OPENROUTER_MODEL')")
                config = {row['key']: row['value'] for row in rows}
                db_api_key = config.get('OPENROUTER_API_KEY')
                db_model = config.get('OPENROUTER_MODEL')
        except Exception as e:
            # Fallback a env si hay error de DB (ej: tabla no existe aún o problemas de conexión)
            pass

        api_key = db_api_key or self.api_key
        model = db_model or OPENROUTER_MODEL
        
        return api_key, model

    async def _complete_structured_impl(
        self,
        system_prompt: str,
        user_content: str,
        output_schema: Type[T],
        temperature: float = 0.1,
        max_tokens: int = 8192
    ) -> T:
        api_key, model = await self._get_config()
        
        if not api_key:
             raise Exception("OPENROUTER_API_KEY is missing")

        payload = {
            "model": model,
            "temperature": temperature,

            "max_tokens": max_tokens,
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": output_schema.__name__,
                    "strict": True,
                    "schema": output_schema.model_json_schema()
                }
            },
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ]
        }

        headers = self.headers.copy()
        headers["Authorization"] = f"Bearer {api_key}"

        timeout = float(os.environ.get("OPENROUTER_TIMEOUT", 300.0))
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{OPENROUTER_BASE_URL}/chat/completions",
                headers=headers,
                json=payload
            )
            response.raise_for_status()
            data = response.json()

        raw = data["choices"][0]["message"]["content"].strip()
        # Limpiar posibles bloques markdown que Gemini añade
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip().rstrip("```")

        return output_schema.model_validate_json(raw)
