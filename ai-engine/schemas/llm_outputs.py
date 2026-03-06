from pydantic import BaseModel, Field
from typing import List, Optional


# === Core Analysis Models ===

class FramingAnalysis(BaseModel):
    enfoque_predominante: str
    confianza_framing: float
    perspectiva_temporal: str
    rol_lector_implicito: str
    enfoque_solucion_vs_problema: str
    marcos_narrativos: List[dict]
    lenguaje_carga_emocional: List[dict]
    metaforas_detectadas: List[str]
    llamada_a_accion_implicita: Optional[str] = None
    grupos_beneficiados_segun_texto: List[str]
    grupos_perjudicados_segun_texto: List[str]


class VozIncluida(BaseModel):
    actor: str
    tipo: str
    espacio_relativo: float
    tono_hacia_actor: str
    es_citado_directamente: bool


class SesgoAnalysis(BaseModel):
    voces_incluidas: List[VozIncluida]
    voces_ausentes: List[str]
    orientacion_politica_estimada: str
    confianza_orientacion: float
    sesgo_confirmacion_detectado: bool
    notas_sesgo: Optional[str] = None


class CalidadAnalysis(BaseModel):
    titular_respaldado_por_cuerpo: bool
    tiene_multiples_perspectivas: bool
    tiene_contexto_historico: bool
    tiene_respuesta_afectados: bool
    datos_sin_fuente: bool
    exageracion_detectada: bool
    claridad_distincion_hecho_opinion: bool
    contexto_omitido_relevante: bool
    nota_contexto_omitido: Optional[str] = None
    score_verificabilidad: float


class AlertaDesinformacion(BaseModel):
    tipo: str
    descripcion: str
    severidad: str  # info|warning|danger|critical
    fragmento_evidencia: Optional[str] = None
    accion_sugerida: str  # verificar_fuente|buscar_contexto|contrastar_versiones|marcar_revision


class RiesgoDesinformacion(BaseModel):
    coherencia_titular_cuerpo: bool
    alertas: List[AlertaDesinformacion] = []
    nota_incoherencia: Optional[str] = None
    nivel_riesgo_global: str


class LinguisticoAnalysis(BaseModel):
    verbos_hecho: List[str]
    verbos_opinion: List[str]
    uso_voz_pasiva: bool
    uso_superlativos: int
    uso_adverbios_intensificadores: List[str]
    ejemplos_agentividad_activa: List[str]
    ejemplos_agentividad_pasiva: List[str]
    densidad_adjetivos_carga: float
    registro_linguistico: str


class IntencionEditorial(BaseModel):
    primaria: str
    score_informativo: float
    score_opinion: float
    score_alarmismo: float
    score_movilizacion: float


class Emociones(BaseModel):
    joy: float
    sadness: float
    anger: float
    fear: float
    disgust: float
    surprise: float
    others: float


# === Geo Intelligence Models (v2) ===

class CoordenadasAproximadas(BaseModel):
    lat: float
    lon: float


class GeoLugar(BaseModel):
    id: str
    nombre_display: str
    tipo: str  # pais|region|ciudad|barrio|instalacion|zona_conflicto|frontera|mar|otro
    rol_narrativo: str  # escenario_principal|escenario_secundario|origen|destino|referencia_historica
    coordenadas_aproximadas: CoordenadasAproximadas
    confianza_geo: float
    ciudad: Optional[str] = None
    provincia: Optional[str] = None
    pais: Optional[str] = None
    menciones_count: int
    fragmento_evidencia: str


class GeoIntelligence(BaseModel):
    lugares_mencionados: List[GeoLugar] = []
    epicentro_geografico: Optional[str] = None
    radio_impacto: str  # local|nacional|regional|global
    tiene_datos_geo_suficientes: bool = False


# === Temporal Intelligence Models (v2) ===

class VentanaTemporal(BaseModel):
    inicio_estimado: str
    fin_estimado: str
    confianza_ventana: float


class EventoFechado(BaseModel):
    id: int
    descripcion: str
    fecha_exacta: Optional[str] = None
    fecha_aproximada: Optional[str] = None
    confianza_fecha: float
    tipo_temporal: str  # antecedente_lejano|antecedente_inmediato|evento_central|consecuencia_directa|proyeccion
    es_hecho_central: bool = False
    certeza_evento: str  # confirmado|inferido|especulativo
    geo_ref: Optional[str] = None
    actores_involucrados: List[str] = []
    fragmento_evidencia: str
    tags_tematicos: List[str] = []


class Proyeccion(BaseModel):
    descripcion: str
    horizonte_temporal: str
    probabilidad_implicita: str  # alta|media|baja|no_especificada
    actor_responsable: Optional[str] = None


class TemporalIntelligence(BaseModel):
    fecha_publicacion_articulo: Optional[str] = None
    ventana_temporal_cubierta: VentanaTemporal
    eventos_fechados: List[EventoFechado] = []
    linea_tiempo_tipo: str  # cronologica|flashback|climax_primero|mixta
    evento_detonante: Optional[int] = None
    tiene_proyecciones_futuras: bool = False
    proyecciones: List[Proyeccion] = []


# === Interaction Metadata Models (v2) ===

class EntidadClicable(BaseModel):
    texto_original: str
    tipo: str  # persona|organizacion|lugar|fecha|concepto|estadistica|cita
    accion_primaria: str  # ver_perfil|ver_mapa|ver_timeline|ver_fuente|ver_definicion|ver_contexto
    tooltip_corto: str
    tooltip_largo: str
    enlace_interno: str
    dato_enriquecido: Optional[str] = None


class BreakdownDisponible(BaseModel):
    id: str
    titulo: str
    tipo: str  # tabla_comparativa|grafico_barras|mapa_calor|lista_ordenada|grafico_temporal
    descripcion: str
    datos_disponibles: bool = True
    componente_sugerido: str


class AccionContextual(BaseModel):
    contexto: str
    label: str
    tipo: str  # filtrar|comparar|exportar|compartir|alertar|investigar
    dato_payload: Optional[str] = None


class InteractionMetadata(BaseModel):
    entidades_clicables: List[EntidadClicable] = []
    breakdowns_disponibles: List[BreakdownDisponible] = []
    acciones_contextuales: List[AccionContextual] = []


# === UI Enrichment Models ===

class UiHints(BaseModel):
    color_dominante: str
    color_acento: str
    icono_categoria: str
    nivel_urgencia_visual: str
    tema_oscuro_recomendado: bool


class HeatmapSegmento(BaseModel):
    id: int
    texto_inicio: str
    texto_fin: str
    tipo: str
    intensidad: float
    color_hint: str
    # v2 extensions
    entidades_en_segmento: List[str] = []
    geos_en_segmento: List[str] = []
    evento_temporal_ref: Optional[int] = None
    es_clicable: bool = True
    accion_click: Optional[str] = None  # ver_breakdown|ver_actor|ver_mapa|ver_fuente|ver_definicion


class RhetoricalHeatmap(BaseModel):
    segmentos: List[HeatmapSegmento]
    segmento_pico: int
    intensidad_media: float


class ActorNodo(BaseModel):
    id: str
    label: str
    tipo: str
    relevancia: float
    sentimiento_hacia: str
    # v2 extensions
    geo_base: Optional[str] = None
    primera_mencion_evento: Optional[int] = None
    ultima_mencion_evento: Optional[int] = None
    tooltip_descripcion: Optional[str] = None


class ActorEnlace(BaseModel):
    origen: str
    destino: str
    tipo_relacion: str
    intensidad: float
    evidencia: str


class ActorNetwork(BaseModel):
    nodos: List[ActorNodo]
    enlaces: List[ActorEnlace]


class NarrativeTimeline(BaseModel):
    estructura_temporal_dominante: str
    tiene_flashback: bool
    tiene_proyeccion_futura: bool
    nota: Optional[str] = None  # v2: references temporal_intelligence


class ReadingExperience(BaseModel):
    tiempo_lectura_minutos: float
    nivel_complejidad: str
    densidad_informativa: float
    fragmento_gancho: str
    frase_mas_cargada: str
    pregunta_critica_no_respondida: str
    lectura_recomendada_para: str


class VsPromedioMedio(BaseModel):
    sesgo_relativo: str
    alarmismo_relativo: str
    calidad_relativa: str


class ComparativaSectorial(BaseModel):
    vs_promedio_medio: VsPromedioMedio
    patron_narrativo_frecuente: bool
    nota_patron: Optional[str] = None


class UiEnrichment(BaseModel):
    ui_hints: UiHints
    rhetorical_heatmap: RhetoricalHeatmap
    actor_network: ActorNetwork
    narrative_timeline: NarrativeTimeline
    reading_experience: ReadingExperience
    comparativa_sectorial: ComparativaSectorial


# === Full Output Model ===

class FullAnalysisOutput(BaseModel):
    resumen_ejecutivo: str
    intencion_editorial: IntencionEditorial
    framing: FramingAnalysis
    sesgo: SesgoAnalysis
    analisis_linguistico: LinguisticoAnalysis
    calidad_periodistica: CalidadAnalysis
    riesgo_desinformacion: RiesgoDesinformacion
    emociones: Emociones
    keywords: List[str]
    scoreCalidad: float
    scoreDesin: float
    scoreClickbait: float
    scoreSesgo: float
    sentimientoLabel: str
    sentimientoScore: float
    esOpinion: bool
    cuerpo_procesado: str
    # v2 new top-level blocks
    geo_intelligence: Optional[GeoIntelligence] = None
    temporal_intelligence: Optional[TemporalIntelligence] = None
    interaction_metadata: Optional[InteractionMetadata] = None
    ui_enrichment: UiEnrichment
