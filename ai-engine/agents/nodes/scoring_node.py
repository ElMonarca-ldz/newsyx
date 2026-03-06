from agents.state import AgentState

async def scoring_node(state: AgentState) -> AgentState:
    """
    v3.0 scoring node — uses LLM-generated scores as primary values,
    falls back to computed scores only if LLM scores are missing.
    """
    print("Calculating final scores (v3.0)...")
    
    llm = state.get("llm_output", {})
    if not llm:
        return state
    
    # v3 LLM now generates scores directly
    llm_score_calidad = llm.get("scoreCalidad")
    llm_score_desin = llm.get("scoreDesin")
    llm_score_clickbait = llm.get("scoreClickbait")
    llm_score_sesgo = llm.get("scoreSesgo")
    
    # Fallback: compute scores from analysis fields if LLM didn't provide them
    calidad = llm.get("calidad_periodistica", {})
    riesgo = llm.get("riesgo_desinformacion", {})
    
    # Computed fallback score_calidad
    if llm_score_calidad is None:
        score_calidad = 0.5
        if calidad.get("titular_respaldado_por_cuerpo"): score_calidad += 0.1
        if calidad.get("tiene_multiples_perspectivas"): score_calidad += 0.15
        if calidad.get("tiene_contexto_historico"): score_calidad += 0.1
        if calidad.get("tiene_respuesta_afectados"): score_calidad += 0.1
        if calidad.get("claridad_distincion_hecho_opinion"): score_calidad += 0.1
        if calidad.get("datos_sin_fuente"): score_calidad -= 0.15
        if calidad.get("exageracion_detectada"): score_calidad -= 0.1
        if calidad.get("contexto_omitido_relevante"): score_calidad -= 0.1
        llm_score_calidad = min(max(score_calidad, 0.0), 1.0)
    
    # Computed fallback score_desinformacion
    if llm_score_desin is None:
        score_desin = 0.0
        if riesgo.get("coherencia_titular_cuerpo") is False: score_desin += 0.3
        if calidad.get("exageracion_detectada"): score_desin += 0.2
        if calidad.get("datos_sin_fuente"): score_desin += 0.2
        if calidad.get("contexto_omitido_relevante"): score_desin += 0.15
        nivel = riesgo.get("nivel_riesgo_global", "bajo")
        if nivel == "alto": score_desin += 0.2
        elif nivel == "critico": score_desin += 0.4
        llm_score_desin = min(max(score_desin, 0.0), 1.0)
    
    # Computed fallback score_clickbait
    if llm_score_clickbait is None:
        score_clickbait = 0.1
        intencion = llm.get("intencion_editorial", {})
        if intencion.get("score_alarmismo", 0) > 0.5: score_clickbait += 0.3
        if riesgo.get("coherencia_titular_cuerpo") is False: score_clickbait += 0.3
        if calidad.get("exageracion_detectada"): score_clickbait += 0.2
        llm_score_clickbait = min(max(score_clickbait, 0.0), 1.0)
    
    # Computed fallback score_sesgo
    if llm_score_sesgo is None:
        score_sesgo = 0.3
        sesgo = llm.get("sesgo", {})
        if sesgo.get("sesgo_confirmacion_detectado"): score_sesgo += 0.3
        conf = sesgo.get("confianza_orientacion", 0)
        if conf > 0.7: score_sesgo += 0.2
        llm_score_sesgo = min(max(score_sesgo, 0.0), 1.0)
    
    # Compute global score (weighted average)
    score_global = round(
        llm_score_calidad * 0.35 +
        (1.0 - llm_score_desin) * 0.25 +
        (1.0 - llm_score_clickbait) * 0.15 +
        (1.0 - llm_score_sesgo) * 0.25,
        2
    )

    # Cross-Media integration (Multi-source validation)
    crossmedia = state.get("crossmedia_analysis", {})
    if crossmedia:
        val_score = crossmedia.get("score_validacion", 1.0)
        is_outlier = crossmedia.get("outlier_narrativo", False)
        
        # Penalize if outlier or low validation score
        if is_outlier or val_score < 0.5:
            print(f"  Multi-source alert: outlier={is_outlier}, val_score={val_score}")
            # Adjust scores: decrease quality, increase desinfo risk
            penalty = (1.0 - val_score) * 0.2
            if is_outlier: penalty += 0.1
            
            llm_score_calidad = max(0.0, llm_score_calidad - penalty)
            llm_score_desin = min(1.0, llm_score_desin + penalty)
            
            # Re-calculate global score after adjustments
            score_global = round(
                llm_score_calidad * 0.35 +
                (1.0 - llm_score_desin) * 0.25 +
                (1.0 - llm_score_clickbait) * 0.15 +
                (1.0 - llm_score_sesgo) * 0.25,
                2
            )

    final_scores = {
        "score_calidad": round(llm_score_calidad, 2),
        "score_desinformacion": round(llm_score_desin, 2),
        "score_clickbait": round(llm_score_clickbait, 2),
        "score_sesgo": round(llm_score_sesgo, 2),
        "score_global": score_global,
        "validacion_multifuente": crossmedia.get("score_validacion") if crossmedia else None
    }
    
    # Merge into final output structure
    state["final_output"] = {
        **llm,
        "scores_finales": final_scores
    }
    
    state["steps_completed"].append("scoring")
    return state
