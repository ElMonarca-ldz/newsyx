"""
test_router_e2e.py
------------------
Test end-to-end del LLMRouter con una noticia real.
Ejecutar dentro del contenedor ai-engine:
  docker exec newsyx-ai-engine-1 python /app/test_router_e2e.py
"""
import asyncio
import sys
import time

sys.path.append("/app")

from llm.router import LLMRouter
from schemas.llm_outputs import FullAnalysisOutput

SYSTEM_PROMPT = """Eres un sistema de análisis de noticias. Analiza el siguiente artículo de noticias y devuelve un JSON estructurado con los campos requeridos."""

USER_CONTENT = """TITULAR: El gobierno anunció nuevas medidas económicas para contener la inflación
FUENTE: Infobae
FECHA: 2026-03-05
CUERPO:
El Ministerio de Economía anunció este miércoles un conjunto de medidas destinadas a contener la inflación que afecta al país desde hace varios meses. Entre las principales medidas se destaca la reducción de aranceles de importación para bienes de primera necesidad, así como la extensión de precios cuidados a nuevos productos de la canasta básica familiar. 
El ministro declaró ante la prensa que estas medidas buscan aliviar el impacto en los sectores más vulnerables de la sociedad. Además, se anunció una licitación de letras del Tesoro para absorber pesos del mercado y reducir la presión inflacionaria.
Los mercados reaccionaron de forma mixta: el dólar paralelo bajó levemente, mientras que las acciones del sector bancario subieron un 2% en promedio en la bolsa de Buenos Aires.
"""

async def main():
    print("=" * 60)
    print("TEST END-TO-END: LLM Router Hub")
    print("=" * 60)

    router = LLMRouter()

    # Verificar estado de los circuit breakers
    print(f"\n[CB STATUS]")
    print(f"  Gemini  : {'ABIERTO ❌' if router.gemini.circuit_breaker.is_open() else 'CERRADO ✅'} (state={router.gemini.circuit_breaker.get_state()})")
    print(f"  Groq    : {'ABIERTO ❌' if router.groq.circuit_breaker.is_open() else 'CERRADO ✅'} (state={router.groq.circuit_breaker.get_state()})")
    print(f"  Router  : {'healthy ✅' if router.is_healthy() else 'unhealthy ❌'}")

    print(f"\n[REQUEST] Enviando noticia al LLM Router...")
    start = time.time()

    try:
        result: FullAnalysisOutput = await router.complete_structured(
            system_prompt=SYSTEM_PROMPT,
            user_content=USER_CONTENT,
            output_schema=FullAnalysisOutput,
            max_tokens=4096
        )
        elapsed = time.time() - start

        print(f"\n✅ ÉXITO - Respuesta recibida en {elapsed:.2f}s")
        print(f"\n[RESULTADO ESTRUCTURADO]")
        print(f"  Titular analizado  : {USER_CONTENT.split(chr(10))[0].replace('TITULAR: ', '')}")
        d = result.model_dump()
        
        # Mostrar los campos más importantes del resultado
        print(f"  Categoría          : {d.get('categoria', 'N/A')}")
        print(f"  Relevancia         : {d.get('relevancia', 'N/A')}")
        print(f"  Sentimiento        : {d.get('sentimiento', d.get('sentiment', 'N/A'))}")
        
        if d.get('geo_intelligence'):
            geo = d['geo_intelligence']
            print(f"  País               : {geo.get('pais', 'N/A')}")
            print(f"  Ciudad             : {geo.get('ciudad', 'N/A')}")
        
        if d.get('entities') or d.get('entidades'):
            ents = d.get('entities') or d.get('entidades') or []
            if ents:
                print(f"  Entidades ({len(ents)})    : {[e.get('name') or e.get('nombre') for e in ents[:3]]}")

        if d.get('tags') or d.get('keywords'):
            tags = d.get('tags') or d.get('keywords') or []
            print(f"  Tags               : {tags[:5]}")

        print(f"\n[CB STATUS POST-REQUEST]")
        print(f"  Gemini  : {router.gemini.circuit_breaker.get_state()}")
        print(f"  Groq    : {router.groq.circuit_breaker.get_state()}")
        print(f"\n{'='*60}")
        print("TEST COMPLETADO EXITOSAMENTE ✅")
        print("="*60)

    except Exception as e:
        elapsed = time.time() - start
        print(f"\n❌ FALLO tras {elapsed:.2f}s: {e}")
        import traceback
        traceback.print_exc()
        
        print(f"\n[CB STATUS POST-FALLO]")
        print(f"  Gemini  : {router.gemini.circuit_breaker.get_state()}")
        print(f"  Groq    : {router.groq.circuit_breaker.get_state()}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
