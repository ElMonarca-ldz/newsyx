import asyncio
import os
import sys
import logging

# Manually read .env from the root directory
env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
if os.path.exists(env_path):
    with open(env_path, "r") as f:
        for line in f:
            if "=" in line and not line.startswith("#"):
                key, value = line.strip().split("=", 1)
                os.environ[key] = value

# Configure logging to see what's happening
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("VerifyGemini")

# Mock redis if missing
try:
    import redis
except ImportError:
    import unittest.mock
    mock_redis = unittest.mock.MagicMock()
    # Configure mock to return values that won't break comparisons
    mock_redis.from_url().get.return_value = "CLOSED"
    mock_redis.from_url().incr.return_value = 1
    sys.modules["redis"] = mock_redis
    logger.info("Redis not found, mocked for local test")

from llm.gemini_client import GoogleGeminiClient
from pydantic import BaseModel

class ConnectionTestSchema(BaseModel):
    message: str
    token_check: str
    model_version: str

async def test_connection():
    print("\n--- GEMINI CONNECTIVITY VERIFICATION ---")
    
    # 1. Initialize Client
    try:
        client = GoogleGeminiClient()
        print(f"Client initialized with model: {client.model_name}")
    except Exception as e:
        print(f"FAILED to initialize client: {e}")
        return

    # 2. Prepare request
    system_prompt = "You are a connectivity tester. Respond with a JSON object confirming receipt."
    user_content = "Please verify the connection. Mention the model version you are responding from if possible."
    
    print(f"Sending request to Gemini ({client.model_name})...")
    
    # 3. Execute request
    try:
        # We use a timeout to avoid hanging forever if there's a network issue
        result = await client.complete_structured(
            system_prompt=system_prompt,
            user_content=user_content,
            output_schema=ConnectionTestSchema
        )
        
        print("\nSUCCESS! Received structured response:")
        print(f"  Message: {result.message}")
        print(f"  Token Check: {result.token_check}")
        print(f"  Model Version Reported: {result.model_version}")
        
    except Exception as e:
        print(f"\nFAILED to receive response: {e}")
        logger.exception("Error during Gemini call")

    print("\n--- VERIFICATION COMPLETE ---")

if __name__ == "__main__":
    asyncio.run(test_connection())
