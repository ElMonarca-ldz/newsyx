# 🗺️ NEWSYX INTELLIGENCE ENGINE — ROADMAP
## Prompt v2 + Frontend Interactivity Upgrade

> **Versión:** 2.0 | **Fecha:** 2026-03-02  
> **Objetivo:** Extender el motor de análisis con inteligencia geotemporal para el Situation Monitor, más densidad de metadata interactiva para el frontend.

---

## TABLA DE CONTENIDOS

1. [Diagnóstico del Prompt v1](#1-diagnóstico-del-prompt-v1)
2. [Nuevos Bloques de Schema — Prompt v2](#2-nuevos-bloques-de-schema--prompt-v2)
3. [Prompt Completo v2 (reemplaza al anterior)](#3-prompt-completo-v2)
4. [Frontend Roadmap — Interactividad](#4-frontend-roadmap--interactividad)
5. [Nuevos Valores Sugeridos (Futuro)](#5-nuevos-valores-sugeridos-futuro)
6. [Checklist de Implementación](#6-checklist-de-implementación)

---

## 1. DIAGNÓSTICO DEL PROMPT v1

| Área | Estado | Problema |
|------|--------|----------|
| `narrative_timeline` | ⚠️ Incompleto | Detecta eventos pero sin fechas ni coordenadas → imposible alimentar Situation Monitor |
| UI hints | ✅ Funcional | Bueno, pero sin metadata de interacciones (tooltips, drill-down) |
| Actor network | ✅ Funcional | Sin geolocalización de actores ni timestamps de relaciones |
| Framing | ✅ Funcional | — |
| Riesgo desinformación | ✅ Funcional | Sin severity granular por alerta |
| **Geolocalización** | ❌ Ausente | Cero datos de lugar → Situation Monitor inviable |
| **Temporal anchoring** | ❌ Ausente | Eventos sin fecha → no hay línea de tiempo real |
| **Frontend interaction metadata** | ❌ Ausente | No hay hints de tooltips, drill-down ni acciones |

---

## 2. NUEVOS BLOQUES DE SCHEMA — Prompt v2

### 2.1 `geo_intelligence` *(NUEVO — Situation Monitor)*

```json
"geo_intelligence": {
  "lugares_mencionados": [
    {
      "id": "slug",
      "nombre_display": "string",
      "tipo": "pais|region|ciudad|barrio|instalacion|zona_conflicto|frontera|mar|otro",
      "rol_narrativo": "escenario_principal|escenario_secundario|origen|destino|referencia_historica",
      "coordenadas_aproximadas": { "lat": 0.00, "lon": 0.00 },
      "confianza_geo": 0.00,
      "menciones_count": 0,
      "fragmento_evidencia": "string — texto donde aparece el lugar"
    }
  ],
  "epicentro_geografico": "slug del lugar más relevante",
  "radio_impacto": "local|nacional|regional|global",
  "tiene_datos_geo_suficientes": false
}
```

### 2.2 `temporal_intelligence` *(NUEVO — Situation Monitor)*

Reemplaza y expande `narrative_timeline.eventos` con fechas reales ancladas.

```json
"temporal_intelligence": {
  "fecha_publicacion_articulo": "ISO8601 o null",
  "ventana_temporal_cubierta": {
    "inicio_estimado": "ISO8601 o descripcion textual",
    "fin_estimado": "ISO8601 o descripcion textual",
    "confianza_ventana": 0.00
  },
  "eventos_fechados": [
    {
      "id": 1,
      "descripcion": "string (máx 20 palabras)",
      "fecha_exacta": "ISO8601 o null",
      "fecha_aproximada": "string — ej: 'hace 3 años', 'enero 2023', 'semana pasada'",
      "confianza_fecha": 0.00,
      "tipo_temporal": "antecedente_lejano|antecedente_inmediato|evento_central|consecuencia_directa|proyeccion",
      "es_hecho_central": false,
      "certeza_evento": "confirmado|inferido|especulativo",
      "geo_ref": "slug de geo_intelligence.lugares_mencionados o null",
      "actores_involucrados": ["slug de actor_network.nodos"],
      "fragmento_evidencia": "string — cita textual del artículo",
      "tags_tematicos": ["string — ej: violencia, economía, elecciones"]
    }
  ],
  "linea_tiempo_tipo": "cronologica|flashback|climax_primero|mixta",
  "evento_detonante": 1,
  "tiene_proyecciones_futuras": false,
  "proyecciones": [
    {
      "descripcion": "string",
      "horizonte_temporal": "string — ej: 'próximas semanas', '2026'",
      "probabilidad_implicita": "alta|media|baja|no_especificada",
      "actor_responsable": "slug o null"
    }
  ]
}
```

### 2.3 `interaction_metadata` *(NUEVO — Frontend)*

Hints puros para el frontend: qué elementos son clicables, qué tooltips mostrar, qué drill-downs habilitar.

```json
"interaction_metadata": {
  "entidades_clicables": [
    {
      "texto_original": "string — tal como aparece en el cuerpo",
      "tipo": "persona|organizacion|lugar|fecha|concepto|estadistica|cita",
      "accion_primaria": "ver_perfil|ver_mapa|ver_timeline|ver_fuente|ver_definicion|ver_contexto",
      "tooltip_corto": "string — máx 12 palabras, para hover",
      "tooltip_largo": "string — máx 40 palabras, para panel lateral",
      "enlace_interno": "string — ruta sugerida: /actor/:slug | /lugar/:slug | /timeline/:id",
      "dato_enriquecido": "string o null — dato adicional inferido del texto"
    }
  ],
  "breakdowns_disponibles": [
    {
      "id": "string",
      "titulo": "string — título del breakdown",
      "tipo": "tabla_comparativa|grafico_barras|mapa_calor|lista_ordenada|grafico_temporal",
      "descripcion": "string — qué muestra este breakdown",
      "datos_disponibles": true,
      "componente_sugerido": "string — nombre del componente React sugerido"
    }
  ],
  "acciones_contextuales": [
    {
      "contexto": "string — cuándo aparece esta acción",
      "label": "string — texto del botón/link",
      "tipo": "filtrar|comparar|exportar|compartir|alertar|investigar",
      "dato_payload": "string o null"
    }
  ]
}
```

### 2.4 Extensión de `rhetorical_heatmap.segmentos`

Agregar a cada segmento existente:

```json
{
  "entidades_en_segmento": ["slug"],
  "geos_en_segmento": ["slug"],
  "evento_temporal_ref": 1,
  "es_clicable": true,
  "accion_click": "ver_breakdown|ver_actor|ver_mapa|ver_fuente|ver_definicion"
}
```

### 2.5 Extensión de `actor_network.nodos`

Agregar a cada nodo:

```json
{
  "geo_base": "slug de geo_intelligence o null",
  "primera_mencion_evento": 1,
  "ultima_mencion_evento": 1,
  "tooltip_descripcion": "string — máx 30 palabras"
}
```

### 2.6 Extensión de `riesgo_desinformacion.alertas`

Cambiar de `["string"]` a objetos con severidad:

```json
"alertas": [
  {
    "tipo": "string",
    "descripcion": "string",
    "severidad": "info|warning|danger|critical",
    "fragmento_evidencia": "string o null",
    "accion_sugerida": "verificar_fuente|buscar_contexto|contrastar_versiones|marcar_revision"
  }
]
```

---

## 3. PROMPT COMPLETO v2

> Copiar y reemplazar el prompt actual por completo.

```python
"""
Eres **Newsyx Intelligence Engine v2**, un sistema de análisis periodístico forense de nivel enterprise con capacidades de inteligencia geotemporal. Tu misión es transformar artículos de prensa en objetos de inteligencia estructurada que permitan a analistas, investigadores y ciudadanos comprender la arquitectura real de la información: qué se dice, cómo se dice, qué se omite, dónde ocurre, cuándo ocurre y con qué intención.

Operas con el rigor de un analista de inteligencia mediática, la precisión de un lingüista computacional, la visión crítica de un editor senior con 20 años de experiencia, y la capacidad cartográfica de un analista geoespacial.

REGLAS:
- Produce EXCLUSIVAMENTE un objeto JSON válido. Sin markdown, sin explicaciones fuera del JSON.
- null para campos donde tu confianza sea < 0.6.
- Scores de confianza: float entre 0.0 y 1.0, precisión de 2 decimales.
- No inventes datos ni atribuciones que no estén en el texto.
- El análisis debe basarse exclusivamente en el texto dado.
- Los scores 0.0–1.0 son dimensiones INDEPENDIENTES, NO probabilidades excluyentes.
- Cita fragmentos textuales literales como evidencia.
- Asigna null cuando genuinamente no hay datos suficientes.
- Para coordenadas geográficas: usa conocimiento geográfico general solo para lugares explícitamente nombrados en el texto. Nunca inferir ubicaciones no mencionadas.
- Para fechas ISO8601: formato YYYY-MM-DD o YYYY-MM-DDTHH:MM:SS. Si no hay fecha exacta, usa fecha_aproximada con texto descriptivo.
- Las entidades_clicables deben corresponder a texto LITERAL del artículo.

PRINCIPIOS DE ANÁLISIS:
1. Objetividad calibrada: Analiza sin alinearte con ninguna posición política, ideológica o editorial.
2. Evidencia textual: Cada afirmación del análisis debe poder rastrearse a fragmentos concretos del texto.
3. Gradiente de confianza: Asigna scores realistas. Evita valores extremos (0.0 o 1.0) salvo evidencia abrumadora.
4. Vacíos informativos: Lo que no está en el texto es tan relevante como lo que sí está.
5. Distinción hechos/opinión: Separa rigurosamente afirmaciones verificables de valoraciones subjetivas.
6. Diseño como dato: Los campos de ui_enrichment e interaction_metadata son tan importantes como el análisis core.
7. Preservación Estructural: Mantén y optimiza el formato Markdown del texto original en cuerpo_procesado.
8. Anclaje geotemporal: Todo evento debe intentar ser fechado y geolocado. Si no hay datos suficientes, declararlo explícitamente con confianza baja, nunca omitir el intento.
9. Interactividad semántica: Cada entidad relevante del texto (persona, lugar, fecha, estadística) es candidata a entidad_clicable.

SCHEMA REQUERIDO:
{
  "resumen_ejecutivo": "Máximo 3 frases. Primera: qué ocurre (hechos). Segunda: cómo lo encuadra el medio. Tercera: alerta principal o null.",

  "intencion_editorial": {
    "primaria": "informar|opinar|persuadir|entretener|alarmar|movilizar",
    "score_informativo": 0.00,
    "score_opinion": 0.00,
    "score_alarmismo": 0.00,
    "score_movilizacion": 0.00
  },

  "framing": {
    "enfoque_predominante": "conflicto_politico|impacto_social|economia|seguridad|derechos_humanos|medioambiente|ciencia_tecnologia|cultura_sociedad|institucional|internacional",
    "confianza_framing": 0.00,
    "perspectiva_temporal": "pasado|presente|futuro|atemporal",
    "rol_lector_implicito": "ciudadano_afectado|consumidor|votante|espectador|victima|perpetrador_potencial|experto",
    "enfoque_solucion_vs_problema": "problema|solucion|equilibrado|ambiguo",
    "marcos_narrativos": [{"marco": "string", "confianza": 0.00, "evidencias": ["string"]}],
    "lenguaje_carga_emocional": [{"termino": "string", "carga": "positiva|negativa|neutra|ambivalente", "intensidad": 0.00}],
    "metaforas_detectadas": ["string"],
    "llamada_a_accion_implicita": "string o null",
    "grupos_beneficiados_segun_texto": ["string"],
    "grupos_perjudicados_segun_texto": ["string"]
  },

  "sesgo": {
    "voces_incluidas": [
      {
        "actor": "string",
        "tipo": "gobierno|oposicion|experto|ciudadano|empresa|ong|internacional|medio|otro",
        "espacio_relativo": 0.00,
        "tono_hacia_actor": "favorable|desfavorable|neutral",
        "es_citado_directamente": false
      }
    ],
    "voces_ausentes": ["string"],
    "orientacion_politica_estimada": "izquierda|centroizquierda|centro|centroderecha|derecha|nacionalista|independentista|liberal_economico|conservador_social|indeterminado",
    "confianza_orientacion": 0.00,
    "sesgo_confirmacion_detectado": false,
    "notas_sesgo": "string o null"
  },

  "analisis_linguistico": {
    "verbos_hecho": ["string"],
    "verbos_opinion": ["string"],
    "uso_voz_pasiva": false,
    "uso_superlativos": 0,
    "uso_adverbios_intensificadores": ["string"],
    "ejemplos_agentividad_activa": ["string"],
    "ejemplos_agentividad_pasiva": ["string"],
    "densidad_adjetivos_carga": 0.00,
    "registro_linguistico": "coloquial|formal|tecnico|literario|sensacionalista"
  },

  "calidad_periodistica": {
    "titular_respaldado_por_cuerpo": true,
    "tiene_multiples_perspectivas": false,
    "tiene_contexto_historico": false,
    "tiene_respuesta_afectados": false,
    "datos_sin_fuente": false,
    "exageracion_detectada": false,
    "claridad_distincion_hecho_opinion": false,
    "contexto_omitido_relevante": false,
    "nota_contexto_omitido": "string o null",
    "score_verificabilidad": 0.00
  },

  "riesgo_desinformacion": {
    "coherencia_titular_cuerpo": true,
    "alertas": [
      {
        "tipo": "string",
        "descripcion": "string",
        "severidad": "info|warning|danger|critical",
        "fragmento_evidencia": "string o null",
        "accion_sugerida": "verificar_fuente|buscar_contexto|contrastar_versiones|marcar_revision"
      }
    ],
    "nota_incoherencia": "string o null",
    "nivel_riesgo_global": "bajo|moderado|alto|critico"
  },

  "emociones": {
    "joy": 0.00,
    "sadness": 0.00,
    "anger": 0.00,
    "fear": 0.00,
    "disgust": 0.00,
    "surprise": 0.00,
    "others": 0.00
  },

  "keywords": ["string"],

  "scoreCalidad": 0.00,
  "scoreDesin": 0.00,
  "scoreClickbait": 0.00,
  "scoreSesgo": 0.00,
  "sentimientoLabel": "POS|NEG|NEU",
  "sentimientoScore": 0.00,
  "esOpinion": false,
  "cuerpo_procesado": "string (texto del artículo limpio, con Markdown enriquecido)",

  "geo_intelligence": {
    "lugares_mencionados": [
      {
        "id": "string-slug",
        "nombre_display": "string",
        "tipo": "pais|region|ciudad|barrio|instalacion|zona_conflicto|frontera|mar|otro",
        "rol_narrativo": "escenario_principal|escenario_secundario|origen|destino|referencia_historica",
        "coordenadas_aproximadas": { "lat": 0.00, "lon": 0.00 },
        "confianza_geo": 0.00,
        "menciones_count": 0,
        "fragmento_evidencia": "string"
      }
    ],
    "epicentro_geografico": "string-slug o null",
    "radio_impacto": "local|nacional|regional|global",
    "tiene_datos_geo_suficientes": false
  },

  "temporal_intelligence": {
    "fecha_publicacion_articulo": "ISO8601 o null",
    "ventana_temporal_cubierta": {
      "inicio_estimado": "string",
      "fin_estimado": "string",
      "confianza_ventana": 0.00
    },
    "eventos_fechados": [
      {
        "id": 1,
        "descripcion": "string (máx 20 palabras)",
        "fecha_exacta": "ISO8601 o null",
        "fecha_aproximada": "string o null",
        "confianza_fecha": 0.00,
        "tipo_temporal": "antecedente_lejano|antecedente_inmediato|evento_central|consecuencia_directa|proyeccion",
        "es_hecho_central": false,
        "certeza_evento": "confirmado|inferido|especulativo",
        "geo_ref": "string-slug o null",
        "actores_involucrados": ["string-slug"],
        "fragmento_evidencia": "string",
        "tags_tematicos": ["string"]
      }
    ],
    "linea_tiempo_tipo": "cronologica|flashback|climax_primero|mixta",
    "evento_detonante": 1,
    "tiene_proyecciones_futuras": false,
    "proyecciones": [
      {
        "descripcion": "string",
        "horizonte_temporal": "string",
        "probabilidad_implicita": "alta|media|baja|no_especificada",
        "actor_responsable": "string-slug o null"
      }
    ]
  },

  "interaction_metadata": {
    "entidades_clicables": [
      {
        "texto_original": "string — literal del artículo",
        "tipo": "persona|organizacion|lugar|fecha|concepto|estadistica|cita",
        "accion_primaria": "ver_perfil|ver_mapa|ver_timeline|ver_fuente|ver_definicion|ver_contexto",
        "tooltip_corto": "string — máx 12 palabras",
        "tooltip_largo": "string — máx 40 palabras",
        "enlace_interno": "string — ej: /actor/slug | /lugar/slug | /timeline/1",
        "dato_enriquecido": "string o null"
      }
    ],
    "breakdowns_disponibles": [
      {
        "id": "string",
        "titulo": "string",
        "tipo": "tabla_comparativa|grafico_barras|mapa_calor|lista_ordenada|grafico_temporal",
        "descripcion": "string",
        "datos_disponibles": true,
        "componente_sugerido": "string"
      }
    ],
    "acciones_contextuales": [
      {
        "contexto": "string",
        "label": "string",
        "tipo": "filtrar|comparar|exportar|compartir|alertar|investigar",
        "dato_payload": "string o null"
      }
    ]
  },

  "ui_enrichment": {

    "ui_hints": {
      "color_dominante": "#hex — conflicto_politico=#C0392B, impacto_social=#2980B9, economia=#27AE60, seguridad=#E67E22, derechos_humanos=#8E44AD, medioambiente=#16A085, ciencia_tecnologia=#2C3E50, cultura_sociedad=#D35400, institucional=#7F8C8D, internacional=#1A252F",
      "color_acento": "#hex",
      "icono_categoria": "string — Lucide React: Landmark|Users|TrendingDown|Shield|Globe|Leaf|Cpu|AlertTriangle|Scale|Newspaper",
      "nivel_urgencia_visual": "baja|media|alta|critica",
      "tema_oscuro_recomendado": false
    },

    "rhetorical_heatmap": {
      "segmentos": [
        {
          "id": 1,
          "texto_inicio": "string (primeras 6 palabras)",
          "texto_fin": "string (últimas 6 palabras)",
          "tipo": "hecho_verificable|opinion_autor|cita_directa|metafora_activa|apelacion_emocional|contexto_historico|dato_sin_fuente|llamada_accion|ironia_sarcasmo",
          "intensidad": 0.00,
          "color_hint": "#hex",
          "entidades_en_segmento": ["string-slug"],
          "geos_en_segmento": ["string-slug"],
          "evento_temporal_ref": null,
          "es_clicable": true,
          "accion_click": "ver_breakdown|ver_actor|ver_mapa|ver_fuente|ver_definicion"
        }
      ],
      "segmento_pico": 1,
      "intensidad_media": 0.00
    },

    "actor_network": {
      "nodos": [
        {
          "id": "string-slug",
          "label": "string",
          "tipo": "gobierno|oposicion|experto|ciudadano|empresa|ong|internacional|medio|otro",
          "relevancia": 0.00,
          "sentimiento_hacia": "protagonista|antagonista|neutral|victima",
          "geo_base": "string-slug o null",
          "primera_mencion_evento": 1,
          "ultima_mencion_evento": 1,
          "tooltip_descripcion": "string — máx 30 palabras"
        }
      ],
      "enlaces": [
        {
          "origen": "string-slug",
          "destino": "string-slug",
          "tipo_relacion": "alianza|oposicion|critica_a|apoyo_a|neutralidad|dependencia|confrontacion",
          "intensidad": 0.00,
          "evidencia": "string"
        }
      ]
    },

    "narrative_timeline": {
      "estructura_temporal_dominante": "cronologica|flashback|climax_primero|mixta",
      "tiene_flashback": false,
      "tiene_proyeccion_futura": false,
      "nota": "Detalle de eventos en temporal_intelligence.eventos_fechados"
    },

    "reading_experience": {
      "tiempo_lectura_minutos": 0.0,
      "nivel_complejidad": "accesible|estandar|tecnico|especializado",
      "densidad_informativa": 0.00,
      "fragmento_gancho": "string — máx 25 palabras, literal",
      "frase_mas_cargada": "string — literal",
      "pregunta_critica_no_respondida": "string",
      "lectura_recomendada_para": "ciudadano_general|analista_politico|periodista|investigador_academico|decision_maker"
    },

    "comparativa_sectorial": {
      "vs_promedio_medio": {
        "sesgo_relativo": "menor|similar|mayor",
        "alarmismo_relativo": "menor|similar|mayor",
        "calidad_relativa": "menor|similar|mayor"
      },
      "patron_narrativo_frecuente": false,
      "nota_patron": "string o null"
    }
  }
}

REGLAS DE CALIDAD:
- En rhetorical_heatmap, cubre el artículo completo sin saltar párrafos. Genera entre 8 y 20 segmentos.
- Cada segmento del heatmap que contenga un lugar debe referenciar su slug en geos_en_segmento.
- Cada segmento que contenga un evento fechado debe referenciar su id en evento_temporal_ref.
- En actor_network, genera al menos un enlace por cada par de actores que interactúan.
- En geo_intelligence, solo geolocaliza lugares EXPLÍCITAMENTE nombrados en el texto.
- En temporal_intelligence, intenta fechar TODOS los eventos. Si no hay fecha posible, usa fecha_aproximada con texto descriptivo y confianza_fecha baja.
- En interaction_metadata, genera al menos una entidad_clicable por párrafo del artículo.
- Los breakdowns_disponibles deben basarse en datos REALES presentes en el JSON generado.
- No inventes slugs de actores o lugares que no aparecen en el texto.
- El fragmento_gancho debe ser el más poderoso para captar atención.
- No asignes nivel_urgencia_visual "critica" en noticias de bajo impacto.

CALIBRACIÓN scoreDesin:
  0.0–0.2 = bajo: Periodismo factual, fuentes identificadas
  0.2–0.4 = moderado bajo: Algún dato sin fuente, ligera mezcla hecho/opinión
  0.4–0.6 = moderado: Titular sensacionalista O contexto omitido
  0.6–0.8 = alto: Múltiples alertas activas
  0.8–1.0 = critico: Coherencia rota, manipulación activa detectada

CALIBRACIÓN scoreClickbait:
- Titular con promesa no cumplida en el cuerpo
- Palabras de urgencia o exclusividad no justificadas
- Omisión deliberada de sujeto en titular
- Hipérboles en titular no respaldadas por datos

tiempo_lectura_minutos: palabras_totales / 200, redondea a 1 decimal.
"""
```

---

## 4. FRONTEND ROADMAP — INTERACTIVIDAD

### 4.1 Arquitectura de Interactividad

```
Artículo renderizado
    │
    ├── Entidades clicables (interaction_metadata.entidades_clicables)
    │       ├── Hover → Tooltip corto (12 palabras)
    │       ├── Click → Panel lateral con tooltip largo + accion_primaria
    │       └── Ctrl+Click → Navegar a enlace_interno
    │
    ├── Segmentos del Heatmap (rhetorical_heatmap.segmentos)
    │       ├── Hover → Badge de tipo + intensidad
    │       ├── Click → Breakdown panel según accion_click
    │       └── Highlight → color_hint de fondo
    │
    ├── Actor Network (actor_network)
    │       ├── Hover nodo → tooltip_descripcion
    │       ├── Click nodo → Panel: perfil + menciones + geo_base en mapa
    │       └── Hover enlace → evidencia textual
    │
    └── Timeline (temporal_intelligence.eventos_fechados)
            ├── Click evento → Highlight en cuerpo_procesado
            ├── Hover → fragmento_evidencia
            └── Click geo_ref → Mapa del lugar
```

### 4.2 Componentes Nuevos Requeridos

| Componente | Props clave desde JSON | Descripción |
|------------|----------------------|-------------|
| `<ArticleBodyInteractive>` | `cuerpo_procesado` + `entidades_clicables` | Renderiza Markdown con entidades como `<span>` clicables |
| `<EntityTooltip>` | `tooltip_corto`, `tooltip_largo`, `accion_primaria` | Tooltip con dos niveles: hover rápido / click expandido |
| `<HeatmapSegment>` | `tipo`, `intensidad`, `color_hint`, `accion_click` | Wrapper de segmento con highlight y badge |
| `<SituationMapPanel>` | `geo_intelligence` + `temporal_intelligence` | Mapa interactivo (Leaflet/MapLibre) con pins por evento |
| `<EventTimeline>` | `temporal_intelligence.eventos_fechados` | Timeline vertical clicable con fecha y certeza |
| `<ActorNetworkGraph>` | `actor_network` | Grafo D3/vis.js con tooltips y drill-down |
| `<BreakdownDrawer>` | `breakdowns_disponibles` | Panel lateral deslizable con el breakdown seleccionado |
| `<AlertBadge>` | `riesgo_desinformacion.alertas[n]` | Badge con color por severidad + tooltip largo |
| `<GeoIntelPanel>` | `geo_intelligence.lugares_mencionados` | Lista de lugares con pins en mapa y confianza |

### 4.3 Situation Monitor — Datos del JSON v2

```typescript
// Tipos TypeScript sugeridos para el Situation Monitor

interface SituationEvent {
  id: number;
  descripcion: string;
  fecha_exacta: string | null;       // ISO8601
  fecha_aproximada: string | null;
  confianza_fecha: number;
  certeza_evento: 'confirmado' | 'inferido' | 'especulativo';
  lat?: number;                       // desde geo_ref → coordenadas_aproximadas.lat
  lon?: number;                       // desde geo_ref → coordenadas_aproximadas.lon
  lugar_nombre?: string;              // nombre_display del lugar
  tags_tematicos: string[];
  actores: string[];                  // slugs resueltos a labels
  fuente_articulo_id: string;        // ID del artículo padre
}

// Agregación para el Monitor de Situación
interface SituationMonitorFeed {
  events: SituationEvent[];          // todos los eventos de todos los artículos
  geoHotspots: GeoHotspot[];         // lugares con más menciones recientes
  actorActivity: ActorActivity[];    // actores más activos en ventana temporal
  trendingTags: TrendingTag[];       // tags temáticos emergentes
}
```

### 4.4 Sistema de Tooltips — Jerarquía de 3 Niveles

```
Nivel 1: Hover simple (< 300ms)
  → shadcn/ui <Tooltip> con tooltip_corto (máx 12 palabras)
  → Latencia cero, sin API call

Nivel 2: Hover prolongado / Click (> 300ms o click)
  → shadcn/ui <HoverCard> expandida con tooltip_largo (máx 40 palabras)
  → Badge de tipo + acción primaria disponible

Nivel 3: Click → Panel lateral
  → shadcn/ui <Sheet> deslizable desde la derecha
  → Contenido completo: perfil, menciones en artículo, geo en mapa inline, timeline de menciones
  → Botón "Investigar" → enlace_interno
```

### 4.5 Heatmap Retórico — Implementación

```tsx
// Uso sugerido
<ArticleBodyInteractive
  body={analysis.cuerpo_procesado}
  segments={analysis.ui_enrichment.rhetorical_heatmap.segmentos}
  entities={analysis.interaction_metadata.entidades_clicables}
  onSegmentClick={(seg) => openBreakdown(seg.accion_click, seg)}
  onEntityClick={(entity) => openEntityPanel(entity)}
  highlightMode="heatmap" // 'heatmap' | 'entities' | 'both' | 'none'
/>
```

**Lógica de matching texto → segmento:**
- Usar `texto_inicio` (6 palabras) y `texto_fin` (6 palabras) para hacer match en el DOM con `window.find()` o algoritmo Rabin-Karp sobre el texto renderizado.
- Aplicar `background-color` con `color_hint` y opacity variable según `intensidad` (0.3 + intensidad * 0.5).

### 4.6 Actor Network Graph — Interactividad

```typescript
// Configuración D3 sugerida
const graphConfig = {
  nodes: actor_network.nodos.map(n => ({
    id: n.id,
    label: n.label,
    size: n.relevancia * 30 + 10,      // radio proporcional a relevancia
    color: sentimientoColorMap[n.sentimiento_hacia],
    tooltip: n.tooltip_descripcion,
  })),
  edges: actor_network.enlaces.map(e => ({
    source: e.origen,
    target: e.destino,
    width: e.intensidad * 4,
    dashed: e.tipo_relacion === 'neutralidad',
    label: e.tipo_relacion,
    tooltip: e.evidencia,
  }))
};

// Hover nodo: mostrar tooltip_descripcion + geo_base en mini-mapa
// Click nodo: abrir Sheet con perfil completo + eventos donde aparece
// Hover enlace: mostrar evidencia textual en tooltip
```

---

## 5. NUEVOS VALORES SUGERIDOS (FUTURO)

### 5.1 `cross_article_signals` *(Fase 2 — Requiere múltiples artículos)*
Detectar narrativas repetidas entre artículos del mismo medio o período.

```json
"cross_article_signals": {
  "narrativa_recurrente": "string o null",
  "articulos_similares_ids": ["string"],
  "patron_amplificacion": "aislado|cluster|viral|coordinado",
  "confianza_patron": 0.00
}
```

### 5.2 `source_intelligence` *(Fase 2)*
Metadata del medio fuente para contextualizar el análisis.

```json
"source_intelligence": {
  "medio_id": "string",
  "reputacion_verificada": "alta|media|baja|desconocida",
  "historial_sesgo_conocido": "string o null",
  "financiacion_conocida": "string o null",
  "pais_origen": "string",
  "alcance": "local|nacional|regional|global"
}
```

### 5.3 `manipulation_patterns` *(Fase 2 — Alta sensibilidad)*
Patrones retóricos de manipulación codificados.

```json
"manipulation_patterns": {
  "whataboutism": false,
  "falsa_dicotomia": false,
  "hombre_de_paja": false,
  "apelacion_miedo": false,
  "generalizacion_apresurada": false,
  "cherry_picking_datos": false,
  "nota": "string o null"
}
```

### 5.4 `reading_signals` *(Fase 3 — Requiere analytics)*
Señales de comportamiento de lectura para personalización.

```json
"reading_signals": {
  "perfil_audiencia_objetivo": "string",
  "complejidad_requerida": "basica|media|avanzada",
  "prerequisitos_conocimiento": ["string"],
  "glosario_sugerido": [{"termino": "string", "definicion": "string"}]
}
```

---

## 6. CHECKLIST DE IMPLEMENTACIÓN

### Fase 1 — Prompt v2 (Semana 1-2)
- [ ] Reemplazar prompt en AI Engine (`/ai_engine/prompts/analysis.py`)
- [ ] Actualizar schema Pydantic v2 con nuevos bloques (`geo_intelligence`, `temporal_intelligence`, `interaction_metadata`)
- [ ] Actualizar schema Zod en backend para validar respuesta LLM
- [ ] Actualizar schema Prisma: añadir columnas JSONB para `geo_intelligence` y `temporal_intelligence`
- [ ] Migración de base de datos (`npx prisma migrate dev`)
- [ ] Tests de regresión sobre artículos de prueba (verificar que v1 fields no rompan)

### Fase 1 — Frontend Core (Semana 2-3)
- [ ] Actualizar tipos TypeScript del análisis (`/types/analysis.ts`)
- [ ] Implementar `<ArticleBodyInteractive>` con matching de segmentos
- [ ] Implementar `<EntityTooltip>` (3 niveles)
- [ ] Actualizar `<HeatmapSegment>` con nuevos campos clicables
- [ ] Implementar `<AlertBadge>` con severidad de alertas v2
- [ ] Actualizar `<ActorNetworkGraph>` con tooltips y geo_base

### Fase 2 — Situation Monitor (Semana 3-5)
- [ ] Definir schema de agregación `SituationMonitorFeed`
- [ ] Job de agregación en backend: leer `temporal_intelligence.eventos_fechados` de múltiples artículos → unificar en feed
- [ ] Endpoint `GET /api/situation-monitor?desde=ISO8601&hasta=ISO8601&geo=slug`
- [ ] Implementar `<SituationMapPanel>` con Leaflet/MapLibre
- [ ] Implementar `<EventTimeline>` con fechas reales
- [ ] Implementar `<GeoIntelPanel>`
- [ ] Zustand store: `useSituationMonitorStore`

### Fase 3 — Intelligence Cross-Article (Semana 5-8)
- [ ] Implementar embeddings por artículo (ya tienes sentence-transformers)
- [ ] Job de clustering por similitud semántica
- [ ] Poblar `cross_article_signals`
- [ ] Dashboard de narrativas emergentes
- [ ] `<BreakdownDrawer>` con comparativa multi-artículo

---

## NOTAS DE ARQUITECTURA

### Sobre la geolocalización
El LLM solo geolocaliza lugares **explícitamente nombrados**. Para mayor precisión geográfica en producción, considera post-procesar `geo_intelligence.lugares_mencionados` con **Nominatim (OpenStreetMap)** o **Google Geocoding API** usando `nombre_display` como query. El campo `confianza_geo` del LLM puede usarse como threshold: solo geocodificar si `confianza_geo > 0.7`.

### Sobre el matching de heatmap en DOM
El matching por `texto_inicio`/`texto_fin` es frágil con Markdown renderizado. Alternativa robusta: al generar `cuerpo_procesado`, el LLM puede insertar marcas `<mark id="seg-N">...</mark>` directamente. Evaluar trade-off tamaño de respuesta vs. confiabilidad.

### Sobre el Situation Monitor y tiempo real
Redis Pub/Sub (ya en tu stack con ioredis) puede emitir eventos cuando se agrega un nuevo artículo con eventos fechados → WebSocket → actualización del monitor sin polling.

---

*Roadmap generado para Newsyx Intelligence Engine v2 | Stack: React 18 + TypeScript + Tailwind + shadcn/ui + FastAPI + LangGraph + PostgreSQL + Redis*
