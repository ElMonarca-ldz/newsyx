import google.generativeai as genai
import os
from dotenv import load_dotenv

# Manually read .env from the root directory
env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
if os.path.exists(env_path):
    with open(env_path, "r") as f:
        for line in f:
            if "=" in line and not line.startswith("#"):
                key, value = line.strip().split("=", 1)
                os.environ[key] = value

api_key = os.environ.get("GOOGLE_API_KEY")
print(f"API Key found: {api_key[:5]}...{api_key[-5:] if api_key else 'None'}")

if not api_key:
    print("Error: GOOGLE_API_KEY not found in environment.")
    exit(1)

try:
    genai.configure(api_key=api_key)
    print("Successfully configured genai.")
    
    print("Available models supporting generateContent:")
    models = genai.list_models()
    count = 0
    for m in models:
        if 'generateContent' in m.supported_generation_methods:
            print(f"- {m.name}")
            count += 1
    
    if count == 0:
        print("No models found with generateContent support.")
except Exception as e:
    print(f"Error during API call: {e}")
