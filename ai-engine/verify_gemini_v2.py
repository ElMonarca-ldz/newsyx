import asyncio
import os
import sys
from pydantic import BaseModel

# Add /app to path (in docker) or current dir to path
sys.path.append("/app")
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from llm.gemini_client import GoogleGeminiClient

class VerifySchema(BaseModel):
    success: bool
    details: str

async def verify():
    print("--- Starting Gemini Optimization Verification ---")
    client = GoogleGeminiClient()
    
    print(f"Model configured: {client.model_name}")
    print(f"Circuit breaker state: {client.circuit_breaker.get_state()} (Healthy: {client.is_healthy()})")
    
    system = "You are a verification assistant. Return JSON with success=true and details about the weather in London (just a few words)."
    user = "Is the verification proceeding?"
    
    try:
        print("Executing complete_structured...")
        result = await client.complete_structured(
            system_prompt=system,
            user_content=user,
            output_schema=VerifySchema
        )
        print(f"VERIFICATION SUCCESS: {result}")
        print(f"Circuit breaker state after call: {client.circuit_breaker.get_state()}")
    except Exception as e:
        print(f"VERIFICATION FAILED: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(verify())
