import os
import google.generativeai as genai
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
        if self.api_key:
            genai.configure(api_key=self.api_key)
        else:
            logger.warning("GOOGLE_API_KEY not set")
            
        self.model_name = os.environ.get("GOOGLE_MODEL", "gemini-2.0-flash")
        if not self.model_name.startswith("models/"):
            self.model_name = f"models/{self.model_name}"
            
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
        
        # Ensure model is prefixed with models/
        if model and not model.startswith("models/"):
            model = f"models/{model}"
            
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

        # Re-configure or use cached? For simplicity, we can re-configure 
        # but configured at class level is usually enough. 
        # Re-configure or use cached? For simplicity, we can re-configure 
        # but configured at class level is usually enough. 
        # If key changes, we need to re-configure.
        genai.configure(api_key=api_key)

        # Fix: Gemini doesn't accept $defs, $ref, anyOf, title, or $schema fields.
        # Pydantic v2 generates these for nested models and Optional[T] fields.
        # We must flatten/inline them before passing the schema to Gemini.
        schema = output_schema.model_json_schema()

        def flatten_schema(obj, defs: dict):
            """Recursively inline $ref, resolve anyOf→type, and remove Gemini-incompatible fields."""
            if isinstance(obj, list):
                return [flatten_schema(item, defs) for item in obj]
            if not isinstance(obj, dict):
                return obj

            # Resolve $ref inline
            if "$ref" in obj:
                ref_path = obj["$ref"]  # e.g. "#/$defs/GeoIntelligence"
                ref_name = ref_path.split("/")[-1]
                ref_obj = defs.get(ref_name, {})
                resolved = flatten_schema(dict(ref_obj), defs)
                extras = {k: v for k, v in obj.items() if k != "$ref"}
                return flatten_schema({**resolved, **extras}, defs)

            # Resolve anyOf → pick the non-null type (Optional[T] pattern)
            # e.g. anyOf: [{type: "string"}, {type: "null"}]  →  {type: "string"}
            if "anyOf" in obj:
                non_null = [s for s in obj["anyOf"] if s.get("type") != "null"]
                sibling_keys = {k: v for k, v in obj.items() if k != "anyOf"}
                if len(non_null) == 1:
                    merged = {**non_null[0], **sibling_keys}
                    return flatten_schema(merged, defs)
                elif len(non_null) > 1:
                    # Multiple non-null options: drop anyOf, keep as generic string
                    merged = {"type": "string", **sibling_keys}
                    return flatten_schema(merged, defs)
                else:
                    # all options are null — treat as string
                    return flatten_schema({"type": "string", **sibling_keys}, defs)

            # Drop fields Gemini doesn't understand
            cleaned = {}
            for k, v in obj.items():
                if k in ("title", "$defs", "$schema", "default"):
                    continue
                cleaned[k] = flatten_schema(v, defs)
            return cleaned

        defs = schema.get("$defs", {})
        schema = flatten_schema(schema, defs)

        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=system_prompt,
            generation_config={
                "temperature": temperature,
                "max_output_tokens": max_tokens,
                "response_mime_type": "application/json",
                "response_schema": schema
            }
        )

        response = await model.generate_content_async(user_content)
        
        if not response.text:
            raise Exception("Gemini returned empty response")
            
        return output_schema.model_validate_json(response.text)
