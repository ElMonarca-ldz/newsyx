import { create } from 'zustand';
import type {
    SituationEvent, EventCluster, SituationFilters,
    LiveAlert, SituationMonitorData
} from '@/types/situation-monitor';

interface SituationMonitorState {
    // Data
    data: SituationMonitorData | null;
    liveAlerts: LiveAlert[];
    unreadAlertsCount: number;

    // Selection
    selectedEventId: string | null;
    selectedClusterId: string | null;
    selectedActorSlug: string | null;
    hoveredGeoSlug: string | null;

    // Filters
    filters: SituationFilters;
    filteredEventos: SituationEvent[];
    filteredClusters: EventCluster[];

    // UI
    feedGroupBy: 'tiempo' | 'lugar' | 'actor' | 'cluster';
    mapDisplayMode: 'pins' | 'heatmap' | 'clusters';
    splitPosition: number;
    isLiveConnected: boolean;
    isSidePanelOpen: boolean;
    isShareModalOpen: boolean;
    sidePanelContent: 'event' | 'cluster' | 'actor' | 'place' | null;
    explorerArticleId: string | null;
    highlightedQuote: string | null;
    actorTimeline: any[] | null;
    shareEventData: SituationEvent | null;
    feedWidth: number;
    sidePanelWidth: number;
    theme: 'dark' | 'light';

    // Actions
    setData: (data: SituationMonitorData) => void;
    selectEvent: (id: string | null) => void;
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
    setShareModalOpen: (open: boolean) => void;
    selectArticleForExplorer: (id: string | null) => void;
    setHighlightedQuote: (quote: string | null) => void;
    selectActor: (slug: string | null) => void;
    setActorTimeline: (data: any[] | null) => void;
    setShareEventData: (event: SituationEvent | null) => void;
    setFeedWidth: (width: number) => void;
    setSidePanelWidth: (width: number) => void;
    setTheme: (theme: 'dark' | 'light') => void;
}

const getToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
};

const getDateOffset = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0]; // Return YYYY-MM-DD for easier comparison
};

const DEFAULT_FILTERS: SituationFilters = {
    fechaDesde: getDateOffset(-7),
    fechaHasta: getDateOffset(7),
    lugaresIds: [],
    actoresIds: [],
    tagsTematicos: [],
    certeza: ['confirmado', 'inferido', 'especulativo'],
    tipoTemporal: [],
    soloHechosCentrales: false,
    scoreDesinMax: 1.0,
    categorias: [],
};

function applyFilters(
    eventos: SituationEvent[],
    clusters: EventCluster[],
    filters: SituationFilters
) {
    const filtered = eventos.filter((e) => {
        // Use only the date part for comparison to avoid time-of-day edge cases
        const eventDate = e.fecha_exacta?.split('T')[0];

        if (filters.fechaDesde && eventDate && eventDate < filters.fechaDesde) return false;
        if (filters.fechaHasta && eventDate && eventDate > filters.fechaHasta) return false;
        if (filters.lugaresIds.length && (!e.lugar || !filters.lugaresIds.includes(e.lugar.slug))) return false;
        if (filters.actoresIds.length && !e.actores_resueltos.some((a: any) => filters.actoresIds.includes(a.slug))) return false;
        if (filters.tagsTematicos.length && !e.tags_tematicos.some((t: any) => filters.tagsTematicos.includes(t))) return false;
        if (!filters.certeza.includes(e.certeza_evento)) return false;
        if (filters.tipoTemporal.length && !filters.tipoTemporal.includes(e.tipo_temporal)) return false;
        if (filters.soloHechosCentrales && !e.es_hecho_central) return false;
        if (e.articulo.scoreDesin > filters.scoreDesinMax) return false;
        if (filters.categorias.length && (!e.articulo.categoria || !filters.categorias.includes(e.articulo.categoria))) return false;
        return true;
    });

    const filteredEventIds = new Set(filtered.map((e: SituationEvent) => `${e.articulo.id}-${e.id}`));
    const filteredClusters2 = clusters.filter((c: EventCluster) =>
        c.eventos.some((e: SituationEvent) => filteredEventIds.has(`${e.articulo.id}-${e.id}`))
    );

    return { filteredEventos: filtered, filteredClusters: filteredClusters2 };
}

export const useSituationMonitorStore = create<SituationMonitorState>()((set, get) => ({
    data: null,
    liveAlerts: [],
    unreadAlertsCount: 0,
    selectedEventId: null,
    selectedClusterId: null,
    hoveredGeoSlug: null,
    filters: DEFAULT_FILTERS,
    filteredEventos: [],
    filteredClusters: [],
    feedGroupBy: 'tiempo',
    mapDisplayMode: 'clusters',
    splitPosition: 50,
    isLiveConnected: false,
    isSidePanelOpen: false,
    isShareModalOpen: false,
    sidePanelContent: null,
    explorerArticleId: null,
    highlightedQuote: null,
    actorTimeline: null,
    shareEventData: null,
    selectedActorSlug: null,
    feedWidth: 400,
    sidePanelWidth: 400,
    theme: (localStorage.getItem('newsyx-theme') as 'dark' | 'light') || 'dark',

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
    setShareModalOpen: (open) => set({ isShareModalOpen: open }),
    selectArticleForExplorer: (id) => set({
        explorerArticleId: id,
        selectedActorSlug: null
    }),
    setHighlightedQuote: (quote) => set({ highlightedQuote: quote }),
    selectActor: (slug) => set({
        selectedActorSlug: slug,
        selectedEventId: null,
        selectedClusterId: null,
    }),
    setActorTimeline: (data) => set({ actorTimeline: data }),
    setShareEventData: (event) => set({ shareEventData: event }),
    setFeedWidth: (width) => set({ feedWidth: width }),
    setSidePanelWidth: (width) => set({ sidePanelWidth: width }),
    setTheme: (theme) => {
        localStorage.setItem('newsyx-theme', theme);
        document.documentElement.classList.toggle('dark', theme === 'dark');
        set({ theme });
    }
}));
