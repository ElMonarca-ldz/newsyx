import os
import json
import logging
import httpx
from typing import TypeVar, Type
from pydantic import BaseModel
from utils.circuit_breaker import RedisCircuitBreaker

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

# G4F Interference API endpoint (separate Docker container)
G4F_API_BASE = os.environ.get("G4F_API_BASE", "http://g4f:8080/v1")

# Models that strictly require authentication (HAR/Session)
G4F_AUTH_MODELS = [
    "gpt-4o",
    "gpt-4o-mini",
    "claude-3-5-sonnet",
]

# Models/Providers that are stable and auth-free
G4F_AUTH_FREE_MODELS = [
    "blackboxai",
    "duckduckgo",
    "deepl-v3",
    "llama-3.3-70b",
    "pi",
]

# Combined rotation for general use (Excluding auth-heavy models for stability by default)
G4F_MODEL_ROTATION = G4F_AUTH_FREE_MODELS


class GPT4FreeClient:
    def __init__(self):
        self.model_name = os.environ.get("GPT4FREE_MODEL", "duckduckgo")
        self.circuit_breaker = RedisCircuitBreaker(
            name="gpt4free",
            failure_threshold=5,
            recovery_timeout=30
        )

    def is_healthy(self) -> bool:
        """Check if the g4f API service is reachable."""
        return not self.circuit_breaker.is_open()

    async def complete_structured(
        self,
        system_prompt: str,
        user_content: str,
        output_schema: Type[T],
        temperature: float = 0.1,
        max_tokens: int = 4096
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

        db_model = None
        try:
            async with get_db_session() as conn:
                row = await conn.fetchrow("SELECT value FROM system_configs WHERE key = 'GPT4FREE_MODEL'")
                if row:
                    db_model = row['value']
        except Exception:
            pass

        return db_model or self.model_name

    async def _call_g4f_api(self, model: str, messages: list, temperature: float) -> str:
        """Call the g4f Interference API (OpenAI-compatible)."""
        async with httpx.AsyncClient(timeout=300.0) as client:
            try:
                response = await client.post(
                    f"{G4F_API_BASE}/chat/completions",
                    json={
                        "model": model,
                        "messages": messages,
                        "temperature": temperature,
                    },
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == 401:
                    logger.error(f"GPT4Free model '{model}' failed with 401 Unauthorized. This usually means the HAR file session has expired. Please re-export the .har file from chatgpt.com.")
                    raise Exception(f"401 Unauthorized: HAR session expired for {model}")
                
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
            except httpx.HTTPError as e:
                logger.warning(f"HTTP error calling g4f API for model {model}: {e}")
                raise

    async def _complete_structured_impl(
        self,
        system_prompt: str,
        user_content: str,
        output_schema: Type[T],
        temperature: float = 0.1,
        max_tokens: int = 4096
    ) -> T:
        primary_model = await self._get_config()

        # Build rotation: primary model first, then the rest
        rotation = [primary_model] + [m for m in G4F_MODEL_ROTATION if m != primary_model]

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]

        json_instruction = f"\n\nIMPORTANT: Return ONLY a valid JSON object matching this schema: {json.dumps(output_schema.model_json_schema())}. Do not include markdown formatting or extra text."
        messages[1]["content"] += json_instruction

        last_error: Exception = Exception("GPT4Free: no models attempted")

        for model_name in rotation:
            try:
                content = await self._call_g4f_api(model_name, messages, temperature)

                if not content:
                    raise Exception("GPT4Free returned empty response")

                # Clean response
                logger.info(f"Raw GPT4Free response from {model_name}: {content[:200]}...")
                raw = content.strip()
                
                # Robust JSON extraction
                if "```json" in raw:
                    raw = raw.split("```json")[-1].split("```")[0].strip()
                elif "```" in raw:
                    raw = raw.split("```")[-1].split("```")[0].strip()
                
                # Extract first { and last } to handle any trailing/leading text
                start_idx = raw.find('{')
                end_idx = raw.rfind('}')
                if start_idx != -1 and end_idx != -1 and end_idx >= start_idx:
                    raw = raw[start_idx:end_idx + 1]

                # Special fix for string vs list validation errors
                try:
                    result = output_schema.model_validate_json(raw)
                except Exception as ve:
                    # Attempt to fix the most common error: string instead of list for 'categories'
                    if "categories" in raw and '"categories": "' in raw:
                         import re
                         raw = re.sub(r'"categories":\s*"([^"]*)"', r'"categories": ["\1"]', raw)
                         result = output_schema.model_validate_json(raw)
                    else:
                        raise ve

                logger.info(f"GPT4Free success with model: {model_name}")
                return result

            except Exception as e:
                logger.warning(f"GPT4Free model '{model_name}' failed: {e}")
                last_error = e
                continue

        logger.error(f"GPT4Free: all models in rotation failed. Last error: {last_error}")
        raise last_error
