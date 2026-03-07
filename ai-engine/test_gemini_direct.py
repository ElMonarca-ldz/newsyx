import asyncio
import os
import sys
from pydantic import BaseModel
from typing import Type, TypeVar

# Add current dir to path to import local modules
sys.path.append("/app")

from llm.gemini_client import GoogleGeminiClient

T = TypeVar("T", bound=BaseModel)

class TestOutput(BaseModel):
    message: str
    status: str

    class Config:
        title = "TestOutput"

async def main():
    print("--- Starting direct Gemini test ---")
    client = GoogleGeminiClient()
    
    print(f"Initial health check: {client.is_healthy()}")
    print(f"Circuit breaker state: {client.circuit_breaker.get_state()}")
    
    system_prompt = "You are a helpful assistant that returns JSON."
    user_content = "Say 'Hello from Gemini' and status 'ok'."
    
    # Note: Using Pydantic 2.x methods as per ai-engine/llm/gemini_client.py
    try:
        print("Sending request to Gemini via GoogleGeminiClient...")
        
        # Test directly using the client's implementation
        result = await client.complete_structured(
            system_prompt=system_prompt,
            user_content=user_content,
            output_schema=TestOutput
        )
        
        print(f"SUCCESS! Response: {result}")
            
    except Exception as e:
        print(f"FAILED! Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
