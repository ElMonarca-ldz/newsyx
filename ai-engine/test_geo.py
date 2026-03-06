import sys
import os

# Add parent dir to path to import utils
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from utils.geo_utils import get_geo_normalizer

def test_normalization():
    normalizer = get_geo_normalizer()
    
    test_data = {
        "lugares_mencionados": [
            {
                "nombre_display": "CABA",
                "tipo": "ciudad",
                "confianza_geo": 0.8
            },
            {
                "nombre_display": "La Feliz",
                "tipo": "ciudad",
                "confianza_geo": 0.7
            },
            {
                "nombre_display": "Rosario",
                "tipo": "ciudad",
                "confianza_geo": 0.9
            },
            {
                "nombre_display": "Lugar Desconocido",
                "tipo": "otro",
                "confianza_geo": 0.5
            }
        ]
    }
    
    print("--- Test Normalization ---")
    normalized = normalizer.normalize(test_data)
    
    for place in normalized["lugares_mencionados"]:
        print(f"Original/Input Name: {place.get('nombre_display')}")
        print(f"  Canonical: {place.get('nombre_display')}")
        print(f"  Provincia: {place.get('provincia')}")
        print(f"  Coords: {place.get('coordenadas_aproximadas')}")
        print(f"  Confidence: {place.get('confianza_geo')}")
        print("-" * 20)

if __name__ == "__main__":
    test_normalization()
