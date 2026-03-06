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
        print("Sending request to Gemini...")
        # Replicate the logic in gemini_client.py:90-106
        import google.generativeai as genai
        api_key = os.environ.get("GOOGLE_API_KEY")
        model_name = "models/gemini-2.0-flash" 
        genai.configure(api_key=api_key)
        
        # genai 0.8.6 with Pydantic 2.x can be tricky. Let's use a very simple manual schema.
        schema = {
            "type": "object",
            "properties": {
                "message": {"type": "string"},
                "status": {"type": "string"}
            },
            "required": ["message", "status"]
        }
        
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=system_prompt,
            generation_config={
                "temperature": 0.1,
                "response_mime_type": "application/json",
                "response_schema": schema
            }
        )
        
        response = await model.generate_content_async(user_content)
        if not response.text:
            print("FAILED! Empty response")
        else:
            result = TestOutput.model_validate_json(response.text)
            print(f"SUCCESS! Response: {result}")
            
    except Exception as e:
        print(f"FAILED! Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
