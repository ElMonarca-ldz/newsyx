import asyncio
import json
from agents.state import AgentState
from agents.nodes.scoring_node import scoring_node

async def test_scoring_integration():
    print("Testing scoring integration with crossmedia analysis...")
    
    # Case 1: Low validation score (Potential misinformation)
    state_misinfo = AgentState(
        llm_output={
            "scoreCalidad": 0.8,
            "scoreDesin": 0.1,
            "scoreClickbait": 0.1,
            "scoreSesgo": 0.2,
            "calidad_periodistica": {"titular_respaldado_por_cuerpo": True},
            "riesgo_desinformacion": {"nivel_riesgo_global": "bajo"}
        },
        crossmedia_analysis={
            "score_validacion": 0.2,
            "outlier_narrativo": True,
            "diferencias_principales": ["Contradice reportes oficiales"]
        },
        steps_completed=[]
    )
    
    result_misinfo = await scoring_node(state_misinfo)
    scores = result_misinfo["final_output"]["scores_finales"]
    
    print(f"\nResults for Low Validation (Outlier):")
    print(f"  Score Calidad (Original 0.8) -> {scores['score_calidad']}")
    print(f"  Score Desin (Original 0.1) -> {scores['score_desinformacion']}")
    print(f"  Score Global -> {scores['score_global']}")
    
    assert scores['score_calidad'] < 0.8, "Quality score should decrease"
    assert scores['score_desinformacion'] > 0.1, "Desinfo score should increase"

    # Case 2: High validation score
    state_valid = AgentState(
        llm_output={
            "scoreCalidad": 0.8,
            "scoreDesin": 0.1,
            "scoreClickbait": 0.1,
            "scoreSesgo": 0.2,
            "calidad_periodistica": {"titular_respaldado_por_cuerpo": True},
            "riesgo_desinformacion": {"nivel_riesgo_global": "bajo"}
        },
        crossmedia_analysis={
            "score_validacion": 0.9,
            "outlier_narrativo": False,
            "diferencias_principales": []
        },
        steps_completed=[]
    )
    
    result_valid = await scoring_node(state_valid)
    scores_valid = result_valid["final_output"]["scores_finales"]
    
    print(f"\nResults for High Validation:")
    print(f"  Score Calidad (Original 0.8) -> {scores_valid['score_calidad']}")
    print(f"  Score Desin (Original 0.1) -> {scores_valid['score_desinformacion']}")
    print(f"  Score Global -> {scores_valid['score_global']}")
    
    assert scores_valid['score_calidad'] == 0.8, "Quality score should stay same"
    
    print("\nTests passed!")

if __name__ == "__main__":
    asyncio.run(test_scoring_integration())
