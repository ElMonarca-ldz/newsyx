from google import genai
import os

api_key = os.environ.get("GOOGLE_API_KEY")
print(f"API Key found: {api_key[:5]}...{api_key[-5:] if api_key else 'None'}")

if not api_key:
    print("Error: GOOGLE_API_KEY not found in environment.")
    exit(1)

try:
    client = genai.Client(api_key=api_key)
    print("Successfully initialized genai Client.")
    
    print("Available Gemini models:")
    count = 0
    # The new SDK list() returns an iterator of Model objects
    for m in client.models.list():
        if "gemini" in m.name:
            print(f"- {m.name}")
            count += 1
    
    if count == 0:
        print("No Gemini models found.")
except Exception as e:
    print(f"Error during API call: {e}")
