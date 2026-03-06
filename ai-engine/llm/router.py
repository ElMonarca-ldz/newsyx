import logging
from typing import TypeVar, Type, Optional
from pydantic import BaseModel
from llm.gemini_client import GoogleGeminiClient
from llm.groq_client import GroqClient
from llm.openrouter_client import OpenRouterClient
from llm.gpt4free_client import GPT4FreeClient
import time

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

class LLMRouter:
    def __init__(self):
        self.gpt4free = GPT4FreeClient()
        self.gemini = GoogleGeminiClient()
        self.groq = GroqClient()
        self.openrouter = OpenRouterClient()
        
    async def complete_structured(
        self,
        system_prompt: str,
        user_content: str,
        output_schema: Type[T],
        temperature: float = 0.1,
        max_tokens: int = 8192
    ) -> T:
        """
        Tries to get a structured response using providers in order:
        0. GPT4Free (Free/Experimental)
        1. Google Gemini
        2. Groq
        3. OpenRouter
        """
        start_time = time.time()
        provider = "unknown"
        model = "unknown"
        status = "failed"
        error_msg = None
        
        # 0. Try GPT4Free
        try:
            if self.gpt4free.is_healthy():
                logger.info("Attempting completion with GPT4Free...")
                provider = "gpt4free"
                model = getattr(self.gpt4free, 'model_name', 'gpt-4o')
                res = await self.gpt4free.complete_structured(
                    system_prompt, user_content, output_schema, temperature, max_tokens
                )
                status = "success"
                await self._log_operation(provider, model, status, start_time)
                return res
        except Exception as e:
            logger.warning(f"GPT4Free failed: {e}")
            error_msg = str(e)
            await self._log_operation(provider, model, "error", start_time, error_msg)

        # Reset start time for next attempt to measure individual latency? 
        # Or keep total? Let's measured per-attempt for better debugging.
        attempt_start = time.time()
        
        # 1. Try Google Gemini
        try:
            if self.gemini.is_healthy() if hasattr(self.gemini, 'is_healthy') else True:
                logger.info("Attempting completion with Google Gemini...")
                provider = "gemini"
                model = getattr(self.gemini, 'model_name', 'gemini-v1')
                res = await self.gemini.complete_structured(
                    system_prompt, user_content, output_schema, temperature, max_tokens
                )
                status = "success"
                await self._log_operation(provider, model, status, attempt_start)
                return res
        except Exception as e:
            logger.warning(f"Google Gemini failed or is unavailable: {e}")
            await self._log_operation("gemini", getattr(self.gemini, 'model_name', 'gemini-v1'), "error", attempt_start, str(e))

        attempt_start = time.time()
        # 2. Try Groq
        try:
            if not hasattr(self.groq, 'is_healthy') or self.groq.is_healthy():
                logger.info("Attempting completion with Groq...")
                provider = "groq"
                model = getattr(self.groq, 'model_name', 'llama3')
                res = await self.groq.complete_structured(
                    system_prompt, user_content, output_schema, temperature, max_tokens
                )
                status = "success"
                await self._log_operation(provider, model, status, attempt_start)
                return res
        except Exception as e:
            logger.warning(f"Groq failed or is unavailable: {e}")
            await self._log_operation("groq", getattr(self.groq, 'model_name', 'llama3'), "error", attempt_start, str(e))

        attempt_start = time.time()
        # 3. Fallback to OpenRouter (Final resort)
        try:
            logger.info("Attempting completion with OpenRouter (fallback)...")
            provider = "openrouter"
            # We don't have model easily here without calling _get_config, use placeholder
            model = "openrouter-default"
            res = await self.openrouter.complete_structured(
                system_prompt, user_content, output_schema, temperature, max_tokens
            )
            status = "success"
            await self._log_operation(provider, model, status, attempt_start)
            return res
        except Exception as e:
            logger.error(f"All providers failed, including OpenRouter: {e}")
            await self._log_operation("openrouter", "openrouter-default", "critical_error", attempt_start, str(e))
            raise e

    async def _log_operation(self, provider: str, model: str, status: str, start_time: float, error: Optional[str] = None):
        """Logs the LLM operation to the database."""
        from database.postgres import get_db_session
        latency = int((time.time() - start_time) * 1000)
        try:
            async with get_db_session() as conn:
                await conn.execute(
                    """
                    INSERT INTO llm_logs (id, provider, model, status, latency_ms, error_message, created_at)
                    VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())
                    """,
                    provider, model, status, latency, error
                )
        except Exception as e:
            logger.error(f"Failed to log LLM operation: {e}")

    def is_healthy(self) -> bool:
        """The router is healthy if at least one provider is healthy."""
        return (
            (self.gpt4free.is_healthy()) or
            (not hasattr(self.gemini, 'is_healthy') or self.gemini.is_healthy()) or
            (not hasattr(self.groq, 'is_healthy') or self.groq.is_healthy()) or
            (self.openrouter.is_healthy())
        )
