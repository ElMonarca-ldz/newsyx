import os
from typing import TypeVar, Type
from pydantic import BaseModel
import json
import logging
from groq import AsyncGroq
from utils.circuit_breaker import RedisCircuitBreaker

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

class GroqClient:
    def __init__(self):
        self.api_key = os.environ.get("GROQ_API_KEY")
        self.model_name = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
        
        self.circuit_breaker = RedisCircuitBreaker(
            name="groq",
            failure_threshold=3,
            recovery_timeout=300
        )

    def is_healthy(self) -> bool:
        """Check if client is considered healthy by the circuit breaker."""
        return not self.circuit_breaker.is_open()

    async def _get_config(self):
        """Fetch dynamic configuration from database with environment fallback."""
        from database.postgres import get_db_session
        
        db_api_key = None
        db_model = None

        try:
            async with get_db_session() as conn:
                rows = await conn.fetch("SELECT key, value FROM system_configs WHERE key IN ('GROQ_API_KEY', 'GROQ_MODEL')")
                config = {row['key']: row['value'] for row in rows}
                db_api_key = config.get('GROQ_API_KEY')
                db_model = config.get('GROQ_MODEL')
        except Exception:
            pass

        api_key = db_api_key or self.api_key
        model = db_model or self.model_name
        
        return api_key, model

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
            raise Exception("GROQ_API_KEY is missing")

        client = AsyncGroq(api_key=api_key)
        
        # Groq supports JSON mode. We provide the schema in the prompt to be safe, 
        # and use response_format={"type": "json_object"}
        # Note: Groq's JSON mode requires the word "JSON" in the system prompt.
        
        enriched_system_prompt = f"{system_prompt}\n\nYou MUST return a valid JSON object matching this schema: {json.dumps(output_schema.model_json_schema())}"
        
        response = await client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": enriched_system_prompt},
                {"role": "user", "content": user_content}
            ],
            temperature=temperature,
            max_tokens=max_tokens,
            response_format={"type": "json_object"}
        )
        
        content = response.choices[0].message.content
        if not content:
            raise Exception("Groq returned empty response")
            
        return output_schema.model_validate_json(content)
