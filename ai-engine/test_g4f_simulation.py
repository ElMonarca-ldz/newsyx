import asyncio
import os
import json
from llm.gpt4free_client import GPT4FreeClient
from pydantic import BaseModel
from typing import List

class TestOutput(BaseModel):
    summary: str
    categories: List[str]

async def main():
    client = GPT4FreeClient()
    print("--- INICIANDO SIMULACIÓN G4F ---")
    print(f"Modelo configurado: {client.model_name}")
    
    system_prompt = "Eres un analista de noticias. Resume la noticia en una frase y asigna categorías."
    user_content = "Noticia: El precio del Bitcoin ha superado los $100,000 por primera vez en la historia, marcando un hito para las criptomonedas."
    
    try:
        print("Enviando solicitud a g4f (gpt-4o-mini)...")
        # Direct call to see raw response
        content = await client._call_g4f_api(
            model='gpt-4o-mini', 
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            temperature=0.1
        )
        print("\n--- RESPUESTA RAW DE G4F ---")
        print(content)
        print("----------------------------")
    except Exception as e:
        print(f"\n❌ Error en la simulación: {e}")

if __name__ == "__main__":
    asyncio.run(main())
