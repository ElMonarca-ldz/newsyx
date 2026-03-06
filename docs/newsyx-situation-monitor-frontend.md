# 🛰️ NEWSYX — SITUATION MONITOR
## Frontend Spec Completa v1.0

> **Stack:** React 18 + TypeScript strict + Tailwind v3 + shadcn/ui + Zustand + TanStack Query v5 + Recharts + React Router v6  
> **Tema:** Dark mode por defecto  
> **Ruta:** `/situation-monitor`

---

## TABLA DE CONTENIDOS

1. [Layout General & Anatomía de la Vista](#1-layout-general--anatomía-de-la-vista)
2. [Tipos TypeScript Core](#2-tipos-typescript-core)
3. [Zustand Store](#3-zustand-store)
4. [WebSocket — Alertas en Tiempo Real](#4-websocket--alertas-en-tiempo-real)
5. [Componente Raíz — SituationMonitor](#5-componente-raíz--situationmonitor)
6. [Panel Izquierdo — MapPanel](#6-panel-izquierdo--mappanel)
7. [Panel Derecho — NewsFeed](#7-panel-derecho--newsfeed)
8. [Panel Superior — Widgets Dashboard](#8-panel-superior--widgets-dashboard)
9. [Sistema de Filtros](#9-sistema-de-filtros)
10. [Clustering de Eventos](#10-clustering-de-eventos)
11. [Backend Endpoint Requerido](#11-backend-endpoint-requerido)
12. [Checklist de Implementación](#12-checklist-de-implementación)

---

## 1. LAYOUT GENERAL & ANATOMÍA DE LA VISTA

```
┌─────────────────────────────────────────────────────────────────────┐
│  TOPBAR: FilterBar (fecha | lugar | actor | tag | certeza)  [LIVE●] │
├─────────────────────────────────────────────────────────────────────┤
│  WIDGETS ROW                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Eventos  │ │  Lugares │ │ Actores  │ │  Alertas │ │ Artículos│ │
│  │  activos │ │  activos │ │  activos │ │  críticas│ │  nuevos  │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
├────────────────────────────────┬────────────────────────────────────┤
│                                │                                     │
│   MAPA INTERACTIVO             │  NEWS FEED                          │
│   (MapPanel)                   │  (EventFeed)                        │
│                                │                                     │
│   • Pins por evento            │  • Cards de eventos agrupados       │
│   • Clusters visuales          │  • Timeline vertical                │
│   • Heatmap de intensidad      │  • Filtros activos                  │
│   • Mini-timeline al click pin │  • Badge de certeza                 │
│                                │                                     │
│   [Ver cluster]  [Ver artículo]│  [Ver artículo] [Ver en mapa]       │
│                                │                                     │
└────────────────────────────────┴────────────────────────────────────┘
│  BOTTOMBAR: Timeline horizontal global (scrubber de fecha)          │
└─────────────────────────────────────────────────────────────────────┘
```

**Proporciones Tailwind:**
- Widgets row: `h-24` fija
- Panel central: `flex-1` dividido `w-1/2` / `w-1/2` (ajustable con splitter)
- Bottombar: `h-16` fija
- El mapa ocupa `100%` de su contenedor con `position: relative`

---

## 2. TIPOS TYPESCRIPT CORE

```typescript
// /src/types/situation-monitor.ts

// ─── Evento base (del JSON del LLM) ───────────────────────────────────
export interface RawSituationEvent {
  id: number;
  descripcion: string;
  fecha_exacta: string | null;           // ISO8601
  fecha_aproximada: string | null;
  confianza_fecha: number;               // 0.0 – 1.0
  tipo_temporal:
    | 'antecedente_lejano'
    | 'antecedente_inmediato'
    | 'evento_central'
    | 'consecuencia_directa'
    | 'proyeccion';
  es_hecho_central: boolean;
  certeza_evento: 'confirmado' | 'inferido' | 'especulativo';
  geo_ref: string | null;                // slug de lugar
  actores_involucrados: string[];        // slugs
  fragmento_evidencia: string;
  tags_tematicos: string[];
}

// ─── Evento enriquecido (backend lo resuelve) ─────────────────────────
export interface SituationEvent extends RawSituationEvent {
  // Resueltos por el backend desde geo_ref y actores_involucrados
  lugar?: {
    slug: string;
    nombre_display: string;
    lat: number;
    lon: number;
    tipo: GeoTipo;
    radio_impacto: 'local' | 'nacional' | 'regional' | 'global';
  };
  actores_resueltos: Array<{
    slug: string;
    label: string;
    tipo: ActorTipo;
    sentimiento_hacia: SentimientoActor;
  }>;
  // Metadata del artículo padre
  articulo: {
    id: string;
    titulo: string;
    medio: string;
    url: string;
    fecha_publicacion: string;
    scoreDesin: number;
    scoreCalidad: number;
    color_dominante: string;            // del ui_hints
    icono_categoria: string;
  };
  // Calculado por el backend
  cluster_id: string | null;            // ID del cluster al que pertenece
  peso_relevancia: number;              // 0.0 – 1.0, para tamaño de pin
}

// ─── Cluster de eventos ───────────────────────────────────────────────
export interface EventCluster {
  id: string;
  centroide: { lat: number; lon: number };
  eventos: SituationEvent[];
  tags_dominantes: string[];
  certeza_dominante: 'confirmado' | 'inferido' | 'especulativo';
  rango_temporal: { desde: string; hasta: string };
  intensidad: number;                   // 0.0 – 1.0, para heatmap
  label_resumen: string;                // "3 eventos — Buenos Aires — economía"
}

// ─── Filtros activos ──────────────────────────────────────────────────
export interface SituationFilters {
  fechaDesde: string | null;            // ISO8601
  fechaHasta: string | null;
  lugaresIds: string[];                 // slugs
  actoresIds: string[];                 // slugs
  tagsTematicos: string[];
  certeza: Array<'confirmado' | 'inferido' | 'especulativo'>;
  tipoTemporal: RawSituationEvent['tipo_temporal'][];
  soloHechosCentrales: boolean;
  scoreDesinMax: number;                // filtrar artículos poco confiables
}

// ─── Alerta en tiempo real (WebSocket) ───────────────────────────────
export interface LiveAlert {
  id: string;
  tipo: 'nuevo_evento' | 'nuevo_cluster' | 'alerta_desinformacion' | 'breaking';
  severidad: 'info' | 'warning' | 'danger' | 'critical';
  titulo: string;
  descripcion: string;
  evento_id?: number;
  cluster_id?: string;
  articulo_id?: string;
  timestamp: string;                    // ISO8601
  leida: boolean;
}

// ─── Feed item ────────────────────────────────────────────────────────
export interface FeedItem {
  type: 'event' | 'cluster' | 'alert';
  timestamp: string;
  data: SituationEvent | EventCluster | LiveAlert;
}

// ─── Enums ────────────────────────────────────────────────────────────
export type GeoTipo =
  | 'pais' | 'region' | 'ciudad' | 'barrio'
  | 'instalacion' | 'zona_conflicto' | 'frontera' | 'mar' | 'otro';

export type ActorTipo =
  | 'gobierno' | 'oposicion' | 'experto' | 'ciudadano'
  | 'empresa' | 'ong' | 'internacional' | 'medio' | 'otro';

export type SentimientoActor =
  | 'protagonista' | 'antagonista' | 'neutral' | 'victima';

// ─── API Response ─────────────────────────────────────────────────────
export interface SituationMonitorData {
  eventos: SituationEvent[];
  clusters: EventCluster[];
  stats: {
    total_eventos: number;
    total_lugares: number;
    total_actores: number;
    alertas_criticas: number;
    articulos_en_ventana: number;
    ultimo_evento: string;              // ISO8601
  };
  metadata: {
    ventana_desde: string;
    ventana_hasta: string;
    generado_en: string;
  };
}
```

---

## 3. ZUSTAND STORE

```typescript
// /src/stores/situationMonitorStore.ts
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  SituationEvent, EventCluster, SituationFilters,
  LiveAlert, SituationMonitorData
} from '@/types/situation-monitor';

interface SituationMonitorState {
  // ── Data ──────────────────────────────────────────────────────────
  data: SituationMonitorData | null;
  liveAlerts: LiveAlert[];
  unreadAlertsCount: number;

  // ── Selección / foco ──────────────────────────────────────────────
  selectedEventId: number | null;
  selectedClusterId: string | null;
  hoveredGeoSlug: string | null;        // sincroniza mapa ↔ feed
  mapBounds: MapBounds | null;          // bounds actuales del mapa

  // ── Filtros ───────────────────────────────────────────────────────
  filters: SituationFilters;
  filteredEventos: SituationEvent[];    // calculado, no hay que settear directo
  filteredClusters: EventCluster[];

  // ── UI State ──────────────────────────────────────────────────────
  feedGroupBy: 'tiempo' | 'lugar' | 'actor' | 'cluster';
  mapDisplayMode: 'pins' | 'heatmap' | 'clusters';
  splitPosition: number;                // % del ancho del mapa (default 50)
  isLiveConnected: boolean;
  isSidePanelOpen: boolean;
  sidePanelContent: 'event' | 'cluster' | 'actor' | 'place' | null;

  // ── Actions ───────────────────────────────────────────────────────
  setData: (data: SituationMonitorData) => void;
  selectEvent: (id: number | null) => void;
  selectCluster: (id: string | null) => void;
  hoverGeo: (slug: string | null) => void;
  setFilters: (partial: Partial<SituationFilters>) => void;
  resetFilters: () => void;
  setFeedGroupBy: (by: SituationMonitorState['feedGroupBy']) => void;
  setMapDisplayMode: (mode: SituationMonitorState['mapDisplayMode']) => void;
  addLiveAlert: (alert: LiveAlert) => void;
  markAlertsRead: () => void;
  setSplitPosition: (pos: number) => void;
  openSidePanel: (content: SituationMonitorState['sidePanelContent']) => void;
  closeSidePanel: () => void;
  setLiveConnected: (connected: boolean) => void;
}

const DEFAULT_FILTERS: SituationFilters = {
  fechaDesde: null,
  fechaHasta: null,
  lugaresIds: [],
  actoresIds: [],
  tagsTematicos: [],
  certeza: ['confirmado', 'inferido', 'especulativo'],
  tipoTemporal: [],
  soloHechosCentrales: false,
  scoreDesinMax: 1.0,
};

function applyFilters(
  eventos: SituationEvent[],
  clusters: EventCluster[],
  filters: SituationFilters
) {
  const filtered = eventos.filter((e) => {
    if (filters.fechaDesde && e.fecha_exacta && e.fecha_exacta < filters.fechaDesde) return false;
    if (filters.fechaHasta && e.fecha_exacta && e.fecha_exacta > filters.fechaHasta) return false;
    if (filters.lugaresIds.length && (!e.lugar || !filters.lugaresIds.includes(e.lugar.slug))) return false;
    if (filters.actoresIds.length && !e.actores_resueltos.some(a => filters.actoresIds.includes(a.slug))) return false;
    if (filters.tagsTematicos.length && !e.tags_tematicos.some(t => filters.tagsTematicos.includes(t))) return false;
    if (!filters.certeza.includes(e.certeza_evento)) return false;
    if (filters.tipoTemporal.length && !filters.tipoTemporal.includes(e.tipo_temporal)) return false;
    if (filters.soloHechosCentrales && !e.es_hecho_central) return false;
    if (e.articulo.scoreDesin > filters.scoreDesinMax) return false;
    return true;
  });

  const filteredEventIds = new Set(filtered.map(e => `${e.articulo.id}-${e.id}`));
  const filteredClusters = clusters.filter(c =>
    c.eventos.some(e => filteredEventIds.has(`${e.articulo.id}-${e.id}`))
  );

  return { filteredEventos: filtered, filteredClusters };
}

export const useSituationMonitorStore = create<SituationMonitorState>()(
  subscribeWithSelector((set, get) => ({
    data: null,
    liveAlerts: [],
    unreadAlertsCount: 0,
    selectedEventId: null,
    selectedClusterId: null,
    hoveredGeoSlug: null,
    mapBounds: null,
    filters: DEFAULT_FILTERS,
    filteredEventos: [],
    filteredClusters: [],
    feedGroupBy: 'tiempo',
    mapDisplayMode: 'clusters',
    splitPosition: 50,
    isLiveConnected: false,
    isSidePanelOpen: false,
    sidePanelContent: null,

    setData: (data) => {
      const { filteredEventos, filteredClusters } = applyFilters(
        data.eventos, data.clusters, get().filters
      );
      set({ data, filteredEventos, filteredClusters });
    },

    selectEvent: (id) => set({
      selectedEventId: id,
      selectedClusterId: null,
      isSidePanelOpen: id !== null,
      sidePanelContent: id !== null ? 'event' : null,
    }),

    selectCluster: (id) => set({
      selectedClusterId: id,
      selectedEventId: null,
      isSidePanelOpen: id !== null,
      sidePanelContent: id !== null ? 'cluster' : null,
    }),

    hoverGeo: (slug) => set({ hoveredGeoSlug: slug }),

    setFilters: (partial) => {
      const filters = { ...get().filters, ...partial };
      const { data } = get();
      if (!data) return set({ filters });
      const { filteredEventos, filteredClusters } = applyFilters(
        data.eventos, data.clusters, filters
      );
      set({ filters, filteredEventos, filteredClusters });
    },

    resetFilters: () => {
      const { data } = get();
      const filters = DEFAULT_FILTERS;
      if (!data) return set({ filters });
      const { filteredEventos, filteredClusters } = applyFilters(
        data.eventos, data.clusters, filters
      );
      set({ filters, filteredEventos, filteredClusters });
    },

    setFeedGroupBy: (by) => set({ feedGroupBy: by }),
    setMapDisplayMode: (mode) => set({ mapDisplayMode: mode }),
    setSplitPosition: (pos) => set({ splitPosition: pos }),

    addLiveAlert: (alert) => set((s) => ({
      liveAlerts: [alert, ...s.liveAlerts].slice(0, 100),
      unreadAlertsCount: s.unreadAlertsCount + 1,
    })),

    markAlertsRead: () => set({ unreadAlertsCount: 0 }),
    openSidePanel: (content) => set({ isSidePanelOpen: true, sidePanelContent: content }),
    closeSidePanel: () => set({ isSidePanelOpen: false, sidePanelContent: null }),
    setLiveConnected: (connected) => set({ isLiveConnected: connected }),
  }))
);
```

---

## 4. WEBSOCKET — ALERTAS EN TIEMPO REAL

```typescript
// /src/hooks/useLiveAlerts.ts
import { useEffect, useRef, useCallback } from 'react';
import { useSituationMonitorStore } from '@/stores/situationMonitorStore';
import { useQueryClient } from '@tanstack/react-query';
import type { LiveAlert } from '@/types/situation-monitor';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:4000/ws/situation-monitor';
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

export function useLiveAlerts() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const queryClient = useQueryClient();

  const addAlert = useSituationMonitorStore((s) => s.addLiveAlert);
  const setConnected = useSituationMonitorStore((s) => s.setLiveConnected);
  const setData = useSituationMonitorStore((s) => s.setData);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      reconnectAttempts.current = 0;
      // Subscribirse a todos los eventos del monitor
      ws.send(JSON.stringify({ type: 'subscribe', channel: 'situation_monitor' }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage;

        switch (msg.type) {
          case 'live_alert':
            addAlert(msg.payload as LiveAlert);
            break;

          case 'new_events':
            // Invalidar query para refetch
            queryClient.invalidateQueries({ queryKey: ['situation-monitor'] });
            // Toast de breaking news si severidad alta
            if ((msg.payload as LiveAlert).severidad === 'critical') {
              showBreakingToast(msg.payload as LiveAlert);
            }
            break;

          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
        }
      } catch (err) {
        console.error('[WS] Parse error:', err);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts.current += 1;
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
      }
    };

    ws.onerror = () => ws.close();
  }, [addAlert, setConnected, queryClient]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);
}

// ─── Backend message types ────────────────────────────────────────────
interface WSMessage {
  type: 'live_alert' | 'new_events' | 'ping';
  payload: unknown;
}

// ─── Breaking news toast (shadcn/ui toast) ────────────────────────────
function showBreakingToast(alert: LiveAlert) {
  // Usar el sistema de toast de shadcn/ui
  // import { toast } from '@/components/ui/use-toast'
  console.warn('[BREAKING]', alert.titulo);
}
```

### Backend — Node.js WebSocket Handler

```typescript
// /src/ws/situationMonitorWS.ts (backend Express)
import { WebSocketServer, WebSocket } from 'ws';
import { redis } from '@/lib/redis';   // ioredis instance

export function setupSituationMonitorWS(wss: WebSocketServer) {
  const clients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    clients.add(ws);

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'pong') return; // keepalive
    });

    ws.on('close', () => clients.delete(ws));

    // Keepalive ping cada 30s
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30_000);

    ws.on('close', () => clearInterval(pingInterval));
  });

  // ── Escuchar Redis Pub/Sub ─────────────────────────────────────────
  const subscriber = redis.duplicate();

  subscriber.subscribe('situation_monitor:alerts', (err) => {
    if (err) console.error('[WS] Redis subscribe error:', err);
  });

  subscriber.on('message', (channel, message) => {
    const payload = JSON.parse(message);
    // Broadcast a todos los clientes conectados
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'live_alert', payload }));
      }
    }
  });

  // ── Publisher (llamar desde el AI Engine vía API interna) ─────────
  return {
    broadcast: (alert: object) => {
      redis.publish('situation_monitor:alerts', JSON.stringify(alert));
    }
  };
}
```

---

## 5. COMPONENTE RAÍZ — SituationMonitor

```tsx
// /src/pages/SituationMonitor.tsx
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSituationMonitorStore } from '@/stores/situationMonitorStore';
import { useLiveAlerts } from '@/hooks/useLiveAlerts';
import { FilterBar } from '@/components/situation-monitor/FilterBar';
import { StatsWidgetRow } from '@/components/situation-monitor/StatsWidgetRow';
import { MapPanel } from '@/components/situation-monitor/MapPanel';
import { EventFeed } from '@/components/situation-monitor/EventFeed';
import { TimelineScrubber } from '@/components/situation-monitor/TimelineScrubber';
import { SidePanel } from '@/components/situation-monitor/SidePanel';
import { LiveIndicator } from '@/components/situation-monitor/LiveIndicator';
import { fetchSituationMonitor } from '@/api/situationMonitor';
import type { SituationFilters } from '@/types/situation-monitor';

export default function SituationMonitor() {
  const { filters, setData, splitPosition, setSplitPosition,
          isSidePanelOpen, data: storeData } = useSituationMonitorStore();

  // WebSocket
  useLiveAlerts();

  // Fetch inicial + refetch en cambio de filtros
  const { data, isLoading, error } = useQuery({
    queryKey: ['situation-monitor', filters],
    queryFn: () => fetchSituationMonitor(filters),
    staleTime: 60_000,
    refetchInterval: 120_000,   // polling de respaldo cada 2min
  });

  useEffect(() => {
    if (data) setData(data);
  }, [data, setData]);

  // Splitter drag
  const splitterRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleSplitterMouseDown = () => { isDragging.current = true; };
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const container = document.getElementById('sm-panels');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const pct = Math.min(70, Math.max(30,
        ((e.clientX - rect.left) / rect.width) * 100
      ));
      setSplitPosition(pct);
    };
    const onMouseUp = () => { isDragging.current = false; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [setSplitPosition]);

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden">

      {/* Topbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800 bg-zinc-900">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-wide text-zinc-100">
            SITUATION MONITOR
          </span>
          <LiveIndicator />
        </div>
        <div className="flex-1">
          <FilterBar />
        </div>
      </div>

      {/* Widgets */}
      <StatsWidgetRow />

      {/* Panels */}
      <div id="sm-panels" className="flex flex-1 overflow-hidden relative">
        {/* Map */}
        <div style={{ width: `${splitPosition}%` }} className="relative overflow-hidden">
          <MapPanel />
        </div>

        {/* Splitter */}
        <div
          ref={splitterRef}
          onMouseDown={handleSplitterMouseDown}
          className="w-1 bg-zinc-800 hover:bg-blue-500 cursor-col-resize transition-colors z-10 flex-shrink-0"
        />

        {/* Feed */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <EventFeed />
        </div>

        {/* Side Panel overlay */}
        {isSidePanelOpen && (
          <div className="absolute right-0 top-0 bottom-0 w-96 z-20 shadow-2xl">
            <SidePanel />
          </div>
        )}
      </div>

      {/* Timeline scrubber */}
      <TimelineScrubber />

    </div>
  );
}
```

---

## 6. PANEL IZQUIERDO — MapPanel

```tsx
// /src/components/situation-monitor/MapPanel.tsx
// Usa Leaflet a través de react-leaflet
// npm install react-leaflet leaflet @types/leaflet

import { useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, useMap, CircleMarker,
         Tooltip, Popup, ZoomControl } from 'react-leaflet';
import { useSituationMonitorStore } from '@/stores/situationMonitorStore';
import { EventClusterMarker } from './map/EventClusterMarker';
import { EventHeatmapLayer } from './map/EventHeatmapLayer';
import { MapControls } from './map/MapControls';
import 'leaflet/dist/leaflet.css';

// Tile oscuro de CartoDB para dark mode
const DARK_TILE = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

export function MapPanel() {
  const {
    filteredEventos, filteredClusters, mapDisplayMode,
    selectedEventId, selectedClusterId,
    hoveredGeoSlug, selectEvent, selectCluster, hoverGeo
  } = useSituationMonitorStore();

  // Paleta por certeza
  const certezaColor = {
    confirmado: '#22C55E',    // green-500
    inferido: '#F59E0B',      // amber-500
    especulativo: '#6366F1',  // indigo-500
  } as const;

  // Paleta por tipo temporal
  const tipoColor = {
    antecedente_lejano: '#64748B',
    antecedente_inmediato: '#94A3B8',
    evento_central: '#EF4444',
    consecuencia_directa: '#F97316',
    proyeccion: '#A78BFA',
  } as const;

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={[20, -5]}
        zoom={3}
        zoomControl={false}
        className="w-full h-full bg-zinc-900"
      >
        <TileLayer
          url={DARK_TILE}
          attribution='&copy; <a href="https://carto.com">CARTO</a>'
        />
        <ZoomControl position="bottomright" />

        {/* Controles: pins | heatmap | clusters */}
        <MapControls />

        {/* MODO: Pins individuales */}
        {mapDisplayMode === 'pins' && filteredEventos
          .filter(e => e.lugar?.lat && e.lugar?.lon)
          .map(evento => (
            <CircleMarker
              key={`${evento.articulo.id}-${evento.id}`}
              center={[evento.lugar!.lat, evento.lugar!.lon]}
              radius={8 + evento.peso_relevancia * 12}
              pathOptions={{
                color: certezaColor[evento.certeza_evento],
                fillColor: certezaColor[evento.certeza_evento],
                fillOpacity: selectedEventId === evento.id ? 0.9 : 0.55,
                weight: selectedEventId === evento.id ? 2 : 1,
              }}
              eventHandlers={{
                click: () => selectEvent(evento.id),
                mouseover: () => hoverGeo(evento.lugar?.slug ?? null),
                mouseout: () => hoverGeo(null),
              }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
                <EventMapTooltip evento={evento} />
              </Tooltip>
            </CircleMarker>
          ))
        }

        {/* MODO: Clusters */}
        {mapDisplayMode === 'clusters' && filteredClusters.map(cluster => (
          <EventClusterMarker
            key={cluster.id}
            cluster={cluster}
            isSelected={selectedClusterId === cluster.id}
            onSelect={() => selectCluster(cluster.id)}
          />
        ))}

        {/* MODO: Heatmap */}
        {mapDisplayMode === 'heatmap' && (
          <EventHeatmapLayer eventos={filteredEventos} />
        )}

        {/* Sincronizador mapa ↔ feed (fly-to al seleccionar evento) */}
        <MapFlyTo />
      </MapContainer>

      {/* Leyenda de certeza */}
      <div className="absolute bottom-16 left-3 z-[1000] bg-zinc-900/90 rounded-lg p-3 text-xs border border-zinc-700">
        <p className="text-zinc-400 mb-2 font-medium">Certeza del evento</p>
        {Object.entries(certezaColor).map(([k, color]) => (
          <div key={k} className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-zinc-300 capitalize">{k}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Fly-to al seleccionar un evento con lugar
function MapFlyTo() {
  const map = useMap();
  const { selectedEventId, filteredEventos } = useSituationMonitorStore();

  useEffect(() => {
    if (!selectedEventId) return;
    const evento = filteredEventos.find(e => e.id === selectedEventId);
    if (evento?.lugar?.lat && evento?.lugar?.lon) {
      map.flyTo([evento.lugar.lat, evento.lugar.lon], 8, { duration: 1.2 });
    }
  }, [selectedEventId, filteredEventos, map]);

  return null;
}

// Tooltip del pin en el mapa
function EventMapTooltip({ evento }: { evento: SituationEvent }) {
  return (
    <div className="min-w-48 max-w-64">
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
          evento.certeza_evento === 'confirmado'
            ? 'bg-green-900 text-green-300'
            : evento.certeza_evento === 'inferido'
              ? 'bg-amber-900 text-amber-300'
              : 'bg-indigo-900 text-indigo-300'
        }`}>
          {evento.certeza_evento}
        </span>
        <span className="text-xs text-zinc-400">{evento.articulo.medio}</span>
      </div>
      <p className="text-sm font-medium text-zinc-100 leading-snug">{evento.descripcion}</p>
      {evento.fecha_exacta && (
        <p className="text-xs text-zinc-400 mt-1">
          {new Date(evento.fecha_exacta).toLocaleDateString('es', { dateStyle: 'medium' })}
        </p>
      )}
      {evento.fecha_aproximada && !evento.fecha_exacta && (
        <p className="text-xs text-zinc-400 mt-1">~ {evento.fecha_aproximada}</p>
      )}
      <p className="text-xs text-zinc-500 mt-1 line-clamp-2">"{evento.fragmento_evidencia}"</p>
    </div>
  );
}
```

### EventClusterMarker

```tsx
// /src/components/situation-monitor/map/EventClusterMarker.tsx
import { CircleMarker, Tooltip } from 'react-leaflet';
import type { EventCluster } from '@/types/situation-monitor';

interface Props {
  cluster: EventCluster;
  isSelected: boolean;
  onSelect: () => void;
}

export function EventClusterMarker({ cluster, isSelected, onSelect }: Props) {
  const count = cluster.eventos.length;
  const radius = Math.min(40, 12 + count * 4);

  const clusterColor =
    cluster.certeza_dominante === 'confirmado' ? '#22C55E'
    : cluster.certeza_dominante === 'inferido' ? '#F59E0B'
    : '#6366F1';

  return (
    <CircleMarker
      center={[cluster.centroide.lat, cluster.centroide.lon]}
      radius={radius}
      pathOptions={{
        color: clusterColor,
        fillColor: clusterColor,
        fillOpacity: isSelected ? 0.8 : 0.4,
        weight: isSelected ? 2.5 : 1.5,
      }}
      eventHandlers={{ click: onSelect }}
    >
      <Tooltip permanent direction="center" className="cluster-label">
        <span className="text-xs font-bold">{count}</span>
      </Tooltip>
      <Tooltip direction="top" offset={[0, -radius]}>
        <div className="text-sm">
          <p className="font-medium">{cluster.label_resumen}</p>
          <p className="text-zinc-400 text-xs mt-1">
            {cluster.rango_temporal.desde} → {cluster.rango_temporal.hasta}
          </p>
          <div className="flex gap-1 flex-wrap mt-1">
            {cluster.tags_dominantes.slice(0, 3).map(tag => (
              <span key={tag} className="text-xs bg-zinc-700 px-1 rounded">{tag}</span>
            ))}
          </div>
        </div>
      </Tooltip>
    </CircleMarker>
  );
}
```

---

## 7. PANEL DERECHO — NewsFeed

```tsx
// /src/components/situation-monitor/EventFeed.tsx
import { useMemo } from 'react';
import { useSituationMonitorStore } from '@/stores/situationMonitorStore';
import { EventCard } from './feed/EventCard';
import { ClusterCard } from './feed/ClusterCard';
import { FeedGroupHeader } from './feed/FeedGroupHeader';
import { FeedToolbar } from './feed/FeedToolbar';

export function EventFeed() {
  const { filteredEventos, filteredClusters, feedGroupBy,
          selectedEventId, selectedClusterId, selectEvent, selectCluster,
          hoveredGeoSlug } = useSituationMonitorStore();

  // Agrupar según feedGroupBy
  const grouped = useMemo(() => {
    if (feedGroupBy === 'cluster') {
      return groupByCluster(filteredEventos, filteredClusters);
    }
    if (feedGroupBy === 'lugar') {
      return groupByLugar(filteredEventos);
    }
    if (feedGroupBy === 'actor') {
      return groupByActor(filteredEventos);
    }
    // Default: tiempo (cronológico inverso)
    return groupByTiempo(filteredEventos);
  }, [filteredEventos, filteredClusters, feedGroupBy]);

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <FeedToolbar />

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {grouped.map((group) => (
          <div key={group.key}>
            <FeedGroupHeader label={group.label} count={group.items.length} />
            {group.items.map((item) => {
              if (item.type === 'cluster') {
                return (
                  <ClusterCard
                    key={item.cluster.id}
                    cluster={item.cluster}
                    isSelected={selectedClusterId === item.cluster.id}
                    onSelect={() => selectCluster(item.cluster.id)}
                  />
                );
              }
              return (
                <EventCard
                  key={`${item.evento.articulo.id}-${item.evento.id}`}
                  evento={item.evento}
                  isSelected={selectedEventId === item.evento.id}
                  isGeoHighlighted={hoveredGeoSlug === item.evento.lugar?.slug}
                  onSelect={() => selectEvent(item.evento.id)}
                />
              );
            })}
          </div>
        ))}

        {grouped.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
            <span className="text-4xl mb-3">🔍</span>
            <p className="text-sm">No hay eventos con los filtros actuales</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

### EventCard

```tsx
// /src/components/situation-monitor/feed/EventCard.tsx
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip, TooltipContent, TooltipTrigger
} from '@/components/ui/tooltip';
import { MapPin, Calendar, ExternalLink, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { SituationEvent } from '@/types/situation-monitor';
import { useSituationMonitorStore } from '@/stores/situationMonitorStore';

interface Props {
  evento: SituationEvent;
  isSelected: boolean;
  isGeoHighlighted: boolean;
  onSelect: () => void;
}

const certezaBadge = {
  confirmado: 'bg-green-900/50 text-green-400 border-green-800',
  inferido: 'bg-amber-900/50 text-amber-400 border-amber-800',
  especulativo: 'bg-indigo-900/50 text-indigo-400 border-indigo-800',
} as const;

const tipoLabel = {
  antecedente_lejano: 'Antecedente',
  antecedente_inmediato: 'Antecedente reciente',
  evento_central: 'Evento central',
  consecuencia_directa: 'Consecuencia',
  proyeccion: 'Proyección',
} as const;

export function EventCard({ evento, isSelected, isGeoHighlighted, onSelect }: Props) {
  const navigate = useNavigate();
  const { hoverGeo } = useSituationMonitorStore();

  const fecha = evento.fecha_exacta
    ? new Date(evento.fecha_exacta).toLocaleDateString('es', { dateStyle: 'medium' })
    : evento.fecha_aproximada
      ? `~ ${evento.fecha_aproximada}`
      : 'Fecha no determinada';

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => hoverGeo(evento.lugar?.slug ?? null)}
      onMouseLeave={() => hoverGeo(null)}
      className={`
        relative rounded-lg border p-3 mb-1.5 cursor-pointer
        transition-all duration-150 select-none
        ${isSelected
          ? 'border-blue-500 bg-blue-950/30 shadow-md shadow-blue-950/50'
          : isGeoHighlighted
            ? 'border-zinc-500 bg-zinc-800/60'
            : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-600 hover:bg-zinc-800/40'
        }
      `}
    >
      {/* Header */}
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {/* Certeza badge */}
            <span className={`text-xs px-1.5 py-0.5 rounded-md border font-medium ${certezaBadge[evento.certeza_evento]}`}>
              {evento.certeza_evento}
            </span>
            {/* Tipo temporal */}
            <span className="text-xs text-zinc-500">
              {tipoLabel[evento.tipo_temporal]}
            </span>
            {/* Hecho central */}
            {evento.es_hecho_central && (
              <span className="text-xs px-1 py-0.5 rounded bg-red-900/40 text-red-400 border border-red-800">
                ★ Central
              </span>
            )}
          </div>

          {/* Descripción */}
          <p className="text-sm text-zinc-100 font-medium leading-snug line-clamp-2">
            {evento.descripcion}
          </p>
        </div>

        {/* Score desin warning */}
        {evento.articulo.scoreDesin > 0.6 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex-shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-48">
              <p className="text-xs">
                Artículo fuente con riesgo de desinformación: {(evento.articulo.scoreDesin * 100).toFixed(0)}%
              </p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-xs text-zinc-400 mb-2">
        {/* Fecha */}
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          <span>{fecha}</span>
          {evento.confianza_fecha < 0.7 && (
            <Tooltip>
              <TooltipTrigger>
                <span className="text-zinc-600 ml-0.5">(?)</span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  Confianza en la fecha: {(evento.confianza_fecha * 100).toFixed(0)}%
                </p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Lugar */}
        {evento.lugar && (
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            <span className="max-w-24 truncate">{evento.lugar.nombre_display}</span>
          </div>
        )}

        {/* Medio */}
        <span className="ml-auto truncate max-w-24 text-zinc-500">
          {evento.articulo.medio}
        </span>
      </div>

      {/* Tags */}
      {evento.tags_tematicos.length > 0 && (
        <div className="flex gap-1 flex-wrap mb-2">
          {evento.tags_tematicos.slice(0, 4).map(tag => (
            <span
              key={tag}
              className="text-xs px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 cursor-pointer hover:border-zinc-500"
              onClick={(e) => {
                e.stopPropagation();
                // Filtrar por tag
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actores */}
      {evento.actores_resueltos.length > 0 && (
        <div className="flex gap-1 flex-wrap mb-2">
          {evento.actores_resueltos.slice(0, 3).map(actor => (
            <Tooltip key={actor.slug}>
              <TooltipTrigger asChild>
                <span
                  className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 cursor-pointer hover:bg-zinc-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/actors/${actor.slug}`);
                  }}
                >
                  {actor.label}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs capitalize">{actor.tipo} · {actor.sentimiento_hacia}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}

      {/* Evidencia textual (expandible) */}
      {isSelected && (
        <div className="mt-2 p-2 bg-zinc-800/50 rounded border border-zinc-700 text-xs text-zinc-300 italic">
          "{evento.fragmento_evidencia}"
          <Button
            size="sm"
            variant="ghost"
            className="h-5 px-2 ml-2 text-xs text-blue-400"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/articles/${evento.articulo.id}`);
            }}
          >
            Ver artículo <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
```

---

## 8. PANEL SUPERIOR — Widgets Dashboard

```tsx
// /src/components/situation-monitor/StatsWidgetRow.tsx
import { useQuery } from '@tanstack/react-query';
import { useSituationMonitorStore } from '@/stores/situationMonitorStore';
import { Sparklines, SparklinesLine } from 'react-sparklines'; // npm install react-sparklines
import { MapPin, Users, Activity, AlertTriangle, Newspaper, TrendingUp } from 'lucide-react';

export function StatsWidgetRow() {
  const { data, liveAlerts, unreadAlertsCount,
          markAlertsRead, filters, setFilters } = useSituationMonitorStore();

  if (!data) return <div className="h-24 bg-zinc-900 border-b border-zinc-800 animate-pulse" />;

  const widgets = [
    {
      id: 'eventos',
      label: 'Eventos activos',
      value: data.stats.total_eventos,
      icon: <Activity className="w-4 h-4 text-blue-400" />,
      color: 'text-blue-400',
      tooltip: 'Total de eventos detectados en la ventana temporal activa',
      clickable: false,
    },
    {
      id: 'lugares',
      label: 'Lugares',
      value: data.stats.total_lugares,
      icon: <MapPin className="w-4 h-4 text-emerald-400" />,
      color: 'text-emerald-400',
      tooltip: 'Lugares únicos mencionados con coordenadas en los eventos',
      clickable: true,
      onClick: () => {/* abrir panel de geo */},
    },
    {
      id: 'actores',
      label: 'Actores',
      value: data.stats.total_actores,
      icon: <Users className="w-4 h-4 text-violet-400" />,
      color: 'text-violet-400',
      tooltip: 'Actores únicos involucrados en los eventos filtrados',
      clickable: true,
    },
    {
      id: 'alertas',
      label: 'Alertas críticas',
      value: data.stats.alertas_criticas,
      badge: unreadAlertsCount > 0 ? unreadAlertsCount : undefined,
      icon: <AlertTriangle className="w-4 h-4 text-red-400" />,
      color: data.stats.alertas_criticas > 0 ? 'text-red-400' : 'text-zinc-400',
      tooltip: 'Alertas de desinformación con severidad critical o danger',
      clickable: true,
      onClick: () => { markAlertsRead(); },
    },
    {
      id: 'articulos',
      label: 'Artículos',
      value: data.stats.articulos_en_ventana,
      icon: <Newspaper className="w-4 h-4 text-zinc-400" />,
      color: 'text-zinc-300',
      tooltip: 'Artículos analizados en la ventana temporal',
      clickable: false,
    },
  ];

  return (
    <div className="flex gap-2 px-4 py-2 bg-zinc-900 border-b border-zinc-800 overflow-x-auto">
      {widgets.map(w => (
        <StatWidget key={w.id} {...w} />
      ))}
    </div>
  );
}

interface StatWidgetProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  tooltip: string;
  badge?: number;
  clickable: boolean;
  onClick?: () => void;
}

function StatWidget({ label, value, icon, color, tooltip, badge, clickable, onClick }: StatWidgetProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          onClick={onClick}
          className={`
            relative flex items-center gap-3 px-4 py-2 rounded-lg bg-zinc-800/60
            border border-zinc-700 min-w-32 flex-shrink-0
            ${clickable ? 'cursor-pointer hover:bg-zinc-700/60 hover:border-zinc-600' : ''}
            transition-colors
          `}
        >
          {icon}
          <div>
            <p className={`text-xl font-bold leading-none ${color}`}>
              {value.toLocaleString()}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
          </div>
          {badge !== undefined && badge > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold px-1">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs max-w-48">{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}
```

---

## 9. SISTEMA DE FILTROS

```tsx
// /src/components/situation-monitor/FilterBar.tsx
import { useState } from 'react';
import { useSituationMonitorStore } from '@/stores/situationMonitorStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Slider } from '@/components/ui/slider';
import { CalendarIcon, MapPin, Users, Tag, X, SlidersHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function FilterBar() {
  const { filters, setFilters, resetFilters, data } = useSituationMonitorStore();
  const [isOpen, setIsOpen] = useState(false);

  // Count active filters
  const activeCount = [
    filters.fechaDesde,
    filters.fechaHasta,
    ...filters.lugaresIds,
    ...filters.actoresIds,
    ...filters.tagsTematicos,
    filters.soloHechosCentrales ? 'central' : null,
    filters.scoreDesinMax < 1.0 ? 'desin' : null,
  ].filter(Boolean).length;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Filtro fecha */}
      <DateRangeFilter />

      {/* Filtro lugar */}
      <GeoFilter />

      {/* Filtro actor */}
      <ActorFilter />

      {/* Filtro tag */}
      <TagFilter />

      {/* Filtros avanzados */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`h-7 text-xs gap-1.5 border-zinc-700 bg-zinc-800 ${
              filters.soloHechosCentrales || filters.scoreDesinMax < 1.0
                ? 'text-blue-400 border-blue-700'
                : 'text-zinc-300'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Avanzado
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 bg-zinc-900 border-zinc-700">
          <div className="space-y-4 p-1">
            {/* Solo hechos centrales */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.soloHechosCentrales}
                onChange={(e) => setFilters({ soloHechosCentrales: e.target.checked })}
                className="rounded border-zinc-600"
              />
              <span className="text-sm text-zinc-300">Solo hechos centrales</span>
            </label>

            {/* Filtro certeza */}
            <div>
              <p className="text-xs text-zinc-400 mb-2">Certeza del evento</p>
              <div className="flex gap-2 flex-wrap">
                {(['confirmado', 'inferido', 'especulativo'] as const).map(c => (
                  <Button
                    key={c}
                    size="sm"
                    variant={filters.certeza.includes(c) ? 'default' : 'outline'}
                    className="h-6 text-xs px-2"
                    onClick={() => {
                      const next = filters.certeza.includes(c)
                        ? filters.certeza.filter(x => x !== c)
                        : [...filters.certeza, c];
                      setFilters({ certeza: next.length ? next : ['confirmado', 'inferido', 'especulativo'] });
                    }}
                  >
                    {c}
                  </Button>
                ))}
              </div>
            </div>

            {/* Score desinformación máximo */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs text-zinc-400">Riesgo desinformación máx.</p>
                <span className="text-xs text-zinc-300">
                  {(filters.scoreDesinMax * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[filters.scoreDesinMax]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={([v]) => setFilters({ scoreDesinMax: v })}
                className="w-full"
              />
              <p className="text-xs text-zinc-600 mt-1">
                Excluye artículos con mayor riesgo de desinformación
              </p>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Reset */}
      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-zinc-400 hover:text-red-400 gap-1"
          onClick={resetFilters}
        >
          <X className="w-3.5 h-3.5" />
          Limpiar ({activeCount})
        </Button>
      )}
    </div>
  );
}
```

---

## 10. CLUSTERING DE EVENTOS

### Lógica de clustering (backend — Node.js)

```typescript
// /src/services/clusteringService.ts (backend)
// Algoritmo: DBSCAN geo-espacial + agrupación temporal
// Dependencias: npm install ml-dbscan

interface ClusterInput {
  evento: SituationEvent;
  lat: number;
  lon: number;
  timestamp: number;  // epoch ms
}

interface ClusterConfig {
  geoEpsilonKm: number;    // radio geográfico en km (default: 100)
  timeWindowDays: number;  // ventana temporal en días (default: 7)
  minPoints: number;       // mínimo de eventos para formar cluster (default: 2)
}

export function clusterEvents(
  eventos: SituationEvent[],
  config: ClusterConfig = { geoEpsilonKm: 100, timeWindowDays: 7, minPoints: 2 }
): EventCluster[] {

  const geoEventos = eventos.filter(e => e.lugar?.lat && e.lugar?.lon);

  // Calcular distancia compuesta (geo + temporal normalizados)
  const distanceMatrix = geoEventos.map((a, i) =>
    geoEventos.map((b, j) => {
      if (i === j) return 0;
      const geoDist = haversineKm(
        a.lugar!.lat, a.lugar!.lon,
        b.lugar!.lat, b.lugar!.lon
      );
      const geoScore = Math.min(1, geoDist / config.geoEpsilonKm);

      const tsA = a.fecha_exacta ? new Date(a.fecha_exacta).getTime() : Date.now();
      const tsB = b.fecha_exacta ? new Date(b.fecha_exacta).getTime() : Date.now();
      const daysDiff = Math.abs(tsA - tsB) / (1000 * 60 * 60 * 24);
      const timeScore = Math.min(1, daysDiff / config.timeWindowDays);

      // Peso: 70% geo, 30% tiempo
      return geoScore * 0.7 + timeScore * 0.3;
    })
  );

  // DBSCAN simplificado
  const clusters: number[] = new Array(geoEventos.length).fill(-1);
  let clusterId = 0;

  const epsilon = 0.5; // umbral de distancia compuesta normalizada

  for (let i = 0; i < geoEventos.length; i++) {
    if (clusters[i] !== -1) continue;
    const neighbors = findNeighbors(i, distanceMatrix, epsilon);
    if (neighbors.length < config.minPoints) {
      clusters[i] = -2; // noise
      continue;
    }
    clusters[i] = clusterId;
    const seed = [...neighbors];
    while (seed.length > 0) {
      const j = seed.pop()!;
      if (clusters[j] === -2) clusters[j] = clusterId;
      if (clusters[j] !== -1) continue;
      clusters[j] = clusterId;
      const jNeighbors = findNeighbors(j, distanceMatrix, epsilon);
      if (jNeighbors.length >= config.minPoints) seed.push(...jNeighbors);
    }
    clusterId++;
  }

  // Construir objetos EventCluster
  const clusterMap = new Map<number, SituationEvent[]>();
  geoEventos.forEach((e, i) => {
    const cId = clusters[i];
    if (cId < 0) return; // noise → cluster individual
    if (!clusterMap.has(cId)) clusterMap.set(cId, []);
    clusterMap.get(cId)!.push(e);
  });

  return Array.from(clusterMap.entries()).map(([cId, evts]) => {
    const lats = evts.map(e => e.lugar!.lat);
    const lons = evts.map(e => e.lugar!.lon);
    const centroide = {
      lat: lats.reduce((a, b) => a + b, 0) / lats.length,
      lon: lons.reduce((a, b) => a + b, 0) / lons.length,
    };

    const tags = evts.flatMap(e => e.tags_tematicos);
    const tagFreq = tags.reduce((acc, t) => {
      acc[t] = (acc[t] ?? 0) + 1; return acc;
    }, {} as Record<string, number>);
    const tags_dominantes = Object.entries(tagFreq)
      .sort(([,a],[,b]) => b - a).slice(0, 5).map(([t]) => t);

    const fechas = evts
      .filter(e => e.fecha_exacta)
      .map(e => e.fecha_exacta!)
      .sort();

    const certezas = evts.map(e => e.certeza_evento);
    const certeza_dominante = (
      certezas.filter(c => c === 'confirmado').length >= certezas.length / 2
        ? 'confirmado'
        : certezas.filter(c => c === 'inferido').length >= certezas.length / 2
          ? 'inferido'
          : 'especulativo'
    ) as EventCluster['certeza_dominante'];

    const lugarNombre = evts[0].lugar?.nombre_display ?? 'Zona desconocida';

    return {
      id: `cluster-${cId}`,
      centroide,
      eventos: evts,
      tags_dominantes,
      certeza_dominante,
      rango_temporal: {
        desde: fechas[0] ?? 'Desconocido',
        hasta: fechas[fechas.length - 1] ?? 'Desconocido',
      },
      intensidad: Math.min(1, evts.length / 10),
      label_resumen: `${evts.length} eventos — ${lugarNombre} — ${tags_dominantes[0] ?? ''}`,
    } satisfies EventCluster;
  });
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNeighbors(idx: number, matrix: number[][], eps: number): number[] {
  return matrix[idx].reduce<number[]>((acc, d, j) => {
    if (j !== idx && d <= eps) acc.push(j);
    return acc;
  }, []);
}
```

---

## 11. BACKEND ENDPOINT REQUERIDO

```typescript
// GET /api/situation-monitor
// Query params: desde, hasta, lugaresIds, actoresIds, tags, certeza,
//               soloHechosCentrales, scoreDesinMax, page, limit

// Express handler
router.get('/situation-monitor', authenticate, async (req, res) => {
  const filters = situationMonitorFiltersSchema.parse(req.query); // Zod

  // 1. Buscar artículos en ventana temporal
  const articulos = await prisma.article.findMany({
    where: {
      publishedAt: {
        gte: filters.desde ? new Date(filters.desde) : subDays(new Date(), 30),
        lte: filters.hasta ? new Date(filters.hasta) : new Date(),
      },
      analysis: {
        scoreDesin: { lte: filters.scoreDesinMax ?? 1.0 }
      }
    },
    include: { analysis: true },
  });

  // 2. Extraer eventos de temporal_intelligence (JSONB)
  let eventos: SituationEvent[] = articulos.flatMap(art => {
    const ti = art.analysis?.temporal_intelligence;
    const geo = art.analysis?.geo_intelligence;
    if (!ti?.eventos_fechados) return [];

    return ti.eventos_fechados.map(ev => enrichEvent(ev, art, geo));
  });

  // 3. Aplicar filtros
  eventos = applyFilters(eventos, filters);

  // 4. Clustering
  const clusters = clusterEvents(eventos, {
    geoEpsilonKm: 150,
    timeWindowDays: 14,
    minPoints: 2,
  });

  // 5. Stats
  const stats = computeStats(eventos, articulos);

  res.json({
    eventos,
    clusters,
    stats,
    metadata: {
      ventana_desde: filters.desde ?? subDays(new Date(), 30).toISOString(),
      ventana_hasta: filters.hasta ?? new Date().toISOString(),
      generado_en: new Date().toISOString(),
    }
  });
});
```

---

## 12. CHECKLIST DE IMPLEMENTACIÓN

### Sprint 1 — Fundamentos (Semana 1)
- [ ] Tipos TS completos en `/src/types/situation-monitor.ts`
- [ ] Zustand store con filtros y `applyFilters`
- [ ] Endpoint backend `GET /api/situation-monitor` con query params
- [ ] `fetchSituationMonitor` en `/src/api/situationMonitor.ts`
- [ ] Ruta `/situation-monitor` en React Router

### Sprint 2 — Mapa + Feed (Semana 2)
- [ ] `npm install react-leaflet leaflet @types/leaflet`
- [ ] `MapPanel` con tile oscuro CartoDB
- [ ] `CircleMarker` por evento (modo pins)
- [ ] `EventClusterMarker` (modo clusters)
- [ ] `EventFeed` con agrupación por tiempo
- [ ] `EventCard` con todos los estados (selected, hovered, expanded)

### Sprint 3 — WebSocket + Alertas (Semana 3)
- [ ] WebSocket handler en Node.js con Redis Pub/Sub
- [ ] `useLiveAlerts` hook con reconexión automática
- [ ] `LiveIndicator` en topbar
- [ ] `StatsWidgetRow` con badge de alertas sin leer
- [ ] Toast de breaking news

### Sprint 4 — Clustering + Filtros (Semana 4)
- [ ] `clusteringService.ts` con DBSCAN compuesto
- [ ] Integrar clusters al endpoint
- [ ] `FilterBar` con todos los filtros
- [ ] `TimelineScrubber` (scrubber horizontal)
- [ ] `SidePanel` con detalle de evento/cluster

### Sprint 5 — Polish (Semana 5)
- [ ] `EventHeatmapLayer` con intensidad
- [ ] Splitter draggable mapa/feed
- [ ] `MapFlyTo` sincronizado con selección en feed
- [ ] Sincronización hover geo mapa ↔ feed
- [ ] Tests E2E del flujo principal

---

*Situation Monitor Frontend Spec v1.0 — Newsyx Intelligence Engine*  
*Stack: React 18 + TypeScript + Tailwind + shadcn/ui + Zustand + TanStack Query + React-Leaflet*
