// /src/types/situation-monitor.ts — Complete TypeScript types for Situation Monitor

// ─── Raw event from LLM JSON ───────────────────────────────────────────
export interface RawSituationEvent {
    id: number;
    descripcion: string;
    fecha_exacta: string | null;
    fecha_aproximada: string | null;
    confianza_fecha: number;
    tipo_temporal:
    | 'antecedente_lejano'
    | 'antecedente_inmediato'
    | 'evento_central'
    | 'consecuencia_directa'
    | 'proyeccion';
    es_hecho_central: boolean;
    certeza_evento: 'confirmado' | 'inferido' | 'especulativo';
    geo_ref: string | null;
    actores_involucrados: string[];
    fragmento_evidencia: string;
    tags_tematicos: string[];
}

// ─── Enriched event (from backend) ──────────────────────────────────────
export interface SituationEvent extends RawSituationEvent {
    lugar?: {
        slug: string;
        nombre_display: string;
        lat: number;
        lon: number;
        ciudad?: string;
        provincia?: string;
        pais?: string;
        tipo: GeoTipo;
        radio_impacto: 'local' | 'nacional' | 'regional' | 'global';
    };
    actores_resueltos: Array<{
        slug: string;
        label: string;
        tipo: ActorTipo;
        sentimiento_hacia: SentimientoActor;
    }>;
    articulo: {
        id: string;
        slug?: string;
        titulo: string;
        medio: string;
        url: string;
        fecha_publicacion: string;
        scoreDesin: number;
        scoreCalidad: number;
        color_dominante: string;
        icono_categoria: string;
        imagen?: string;
        categoria?: string | null;
    };
    cluster_id: string | null;
    peso_relevancia: number;
    es_convergente?: boolean;
}

// ─── Cluster ────────────────────────────────────────────────────────────
export interface EventCluster {
    id: string;
    centroide: { lat: number; lon: number };
    eventos: SituationEvent[];
    tags_dominantes: string[];
    certeza_dominante: 'confirmado' | 'inferido' | 'especulativo';
    rango_temporal: { desde: string; hasta: string };
    intensidad: number;
    label_resumen: string;
    source_diversity?: number;
    es_convergente?: boolean;
}

// ─── Filters ────────────────────────────────────────────────────────────
export interface SituationFilters {
    fechaDesde: string | null;
    fechaHasta: string | null;
    lugaresIds: string[];
    actoresIds: string[];
    tagsTematicos: string[];
    certeza: Array<'confirmado' | 'inferido' | 'especulativo'>;
    tipoTemporal: RawSituationEvent['tipo_temporal'][];
    soloHechosCentrales: boolean;
    scoreDesinMax: number;
    categorias: string[];
}

// ─── Live Alert (WebSocket) ─────────────────────────────────────────────
export interface LiveAlert {
    id: string;
    tipo: 'nuevo_evento' | 'nuevo_cluster' | 'alerta_desinformacion' | 'breaking';
    severidad: 'info' | 'warning' | 'danger' | 'critical';
    titulo: string;
    descripcion: string;
    evento_id?: number;
    cluster_id?: string;
    articulo_id?: string;
    timestamp: string;
    leida: boolean;
}

// ─── Feed item ──────────────────────────────────────────────────────────
export interface FeedItem {
    type: 'event' | 'cluster' | 'alert';
    timestamp: string;
    data: SituationEvent | EventCluster | LiveAlert;
}

// ─── API Response ───────────────────────────────────────────────────────
export interface SituationMonitorData {
    eventos: SituationEvent[];
    clusters: EventCluster[];
    stats: {
        total_eventos: number;
        total_lugares: number;
        total_actores: number;
        alertas_criticas: number;
        anomalias_detectadas: number; // C1
        articulos_en_ventana: number;
        ultimo_evento: string;
    };
    metadata: {
        ventana_desde: string;
        ventana_hasta: string;
        generado_en: string;
    };
}

// ─── Enums ──────────────────────────────────────────────────────────────
export type GeoTipo =
    | 'pais' | 'region' | 'ciudad' | 'barrio'
    | 'instalacion' | 'zona_conflicto' | 'frontera' | 'mar' | 'otro';

export type ActorTipo =
    | 'gobierno' | 'oposicion' | 'experto' | 'ciudadano'
    | 'empresa' | 'ong' | 'internacional' | 'medio' | 'otro';

export type SentimientoActor =
    | 'protagonista' | 'antagonista' | 'neutral' | 'victima';
