import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useSituationMonitorStore } from '@/stores/situationMonitorStore';

// Tile URLs
const DARK_TILE = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const LIGHT_TILE = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

const certezaColor: Record<string, string> = {
    confirmado: '#22C55E',
    inferido: '#F59E0B',
    especulativo: '#6366F1',
};

// Helper to create circular marker icons
const createCircularIcon = (color: string, size: number, isSelected: boolean) => {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="
            width: ${size}px;
            height: ${size}px;
            background-color: ${color};
            border-radius: 50%;
            border: ${isSelected ? '2px solid white' : 'none'};
            box-shadow: ${isSelected ? `0 0 12px ${color}, 0 0 24px ${color}40` : `0 0 6px ${color}60`};
            opacity: ${isSelected ? 1 : 0.8};
            transition: all 0.2s;
        "></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
};

const createClusterIcon = (color: string, size: number, count: number, isSelected: boolean, isConvergent: boolean) => {
    return L.divIcon({
        className: 'custom-cluster-icon',
        html: `<div style="
            width: ${size}px;
            height: ${size}px;
            background-color: ${isConvergent ? '#059669' : color}30;
            border: ${isConvergent ? '3px solid #10B981' : `2px solid ${color}`};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 11px;
            font-weight: bold;
            box-shadow: ${isSelected ? `0 0 16px ${isConvergent ? '#10B981' : color}` : isConvergent ? '0 0 10px #10B98140' : 'none'};
            opacity: ${isSelected ? 1 : 0.8};
            position: relative;
        ">
            ${count}
            ${isConvergent ? `
                <div style="
                    position: absolute;
                    top: -4px;
                    right: -4px;
                    background: #10B981;
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    border: 1px solid #18181b;
                    box-shadow: 0 0 8px #10B981;
                "></div>
            ` : ''}
        </div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
};

export function MapPanel() {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<L.Map | null>(null);
    const markersLayer = useRef<L.LayerGroup | null>(null);

    const {
        filteredEventos, filteredClusters, mapDisplayMode,
        selectedEventId, selectedClusterId,
        selectEvent, selectCluster, hoverGeo, setMapDisplayMode,
        theme
    } = useSituationMonitorStore();
    const tileLayerRef = useRef<L.TileLayer | null>(null);

    // 1. Initialize Map
    useEffect(() => {
        if (!mapContainerRef.current || mapInstance.current) return;

        mapInstance.current = L.map(mapContainerRef.current, {
            zoomControl: false,
            attributionControl: false,
        }).setView([20, 0], 2);

        tileLayerRef.current = L.tileLayer(theme === 'dark' ? DARK_TILE : LIGHT_TILE).addTo(mapInstance.current);
        markersLayer.current = L.layerGroup().addTo(mapInstance.current);

        return () => {
            mapInstance.current?.remove();
            mapInstance.current = null;
        };
    }, []);

    // 1.1 Sync Tile Theme
    useEffect(() => {
        if (tileLayerRef.current) {
            tileLayerRef.current.setUrl(theme === 'dark' ? DARK_TILE : LIGHT_TILE);
        }
    }, [theme]);

    // 2. Synchronize Markers
    useEffect(() => {
        if (!mapInstance.current || !markersLayer.current) return;

        // Clear existing markers
        markersLayer.current.clearLayers();

        if (mapDisplayMode === 'clusters') {
            // Render Clusters
            filteredClusters.forEach(cluster => {
                const { lat, lon } = cluster.centroide;
                if (lat == null || lon == null) return;

                const isSelected = selectedClusterId === cluster.id;
                const color = certezaColor[cluster.certeza_dominante] || '#6366F1';
                const size = 24 + Math.min((cluster.eventos?.length || 0) * 4, 30);

                const marker = L.marker([lat, lon], {
                    icon: createClusterIcon(color, size, cluster.eventos.length, isSelected, !!cluster.es_convergente)
                }).addTo(markersLayer.current!);

                marker.on('click', () => selectCluster(cluster.id));
            });
        } else {
            // Render Pins
            filteredEventos.forEach(evento => {
                const lat = evento.lugar?.lat;
                const lon = evento.lugar?.lon;
                if (lat == null || lon == null) return;

                const isSelected = selectedEventId === `${evento.articulo.id}-${evento.id}`;
                const color = certezaColor[evento.certeza_evento] || '#6366F1';
                const size = 10 + (evento.peso_relevancia || 0) * 14;

                const marker = L.marker([lat, lon], {
                    icon: createCircularIcon(color, size, isSelected),
                    zIndexOffset: isSelected ? 1000 : 0
                }).addTo(markersLayer.current!);

                // Tooltip/Popup behavior
                marker.bindPopup(`
                    <div class="map-popup-content">
                        <p class="map-popup-title">${evento.descripcion}</p>
                        <p class="map-popup-subtitle">
                            ${[evento.lugar?.ciudad, evento.lugar?.provincia, evento.lugar?.pais].filter(Boolean).join(', ') || evento.certeza_evento} • ${evento.tipo_temporal}
                        </p>
                    </div>
                `, { className: 'custom-popup-manual', closeButton: false });

                marker.on('click', (e) => {
                    selectEvent(`${evento.articulo.id}-${evento.id}`);
                    // L.DomEvent.stopPropagation(e);
                });

                marker.on('mouseover', () => {
                    hoverGeo(evento.lugar?.slug ?? null);
                    marker.openPopup();
                });

                marker.on('mouseout', () => {
                    hoverGeo(null);
                    marker.closePopup();
                });

                if (isSelected) {
                    // mapInstance.current?.panTo([lat, lon]);
                }
            });
        }
    }, [filteredEventos, filteredClusters, mapDisplayMode, selectedEventId, selectedClusterId]);

    const geoCount = filteredEventos.filter(e => e.lugar?.lat != null).length;

    return (
        <div className={`relative w-full h-full ${theme === 'dark' ? 'bg-zinc-950' : 'bg-zinc-100'}`}>
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%', background: theme === 'dark' ? '#09090b' : '#f8fafc' }} />

            {/* Map controls */}
            <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1">
                {(['pins', 'clusters', 'heatmap'] as const).map(mode => (
                    <button
                        key={mode}
                        onClick={() => setMapDisplayMode(mode)}
                        className={`px-2.5 py-1 text-xs rounded-md transition-colors ${mapDisplayMode === mode
                            ? 'bg-emerald-600 text-white'
                            : 'bg-zinc-800/90 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                            }`}
                    >
                        {mode === 'pins' ? 'Pins' : mode === 'clusters' ? 'Clusters' : 'Heatmap'}
                    </button>
                ))}
            </div>

            {/* Legend */}
            <div className="absolute bottom-3 left-3 z-[1000] bg-zinc-900/90 backdrop-blur-sm rounded-lg p-3 text-xs border border-zinc-700/50">
                <p className="text-zinc-400 mb-2 font-medium">Certeza del evento</p>
                {Object.entries(certezaColor).map(([k, color]) => (
                    <div key={k} className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-zinc-300 capitalize">{k}</span>
                    </div>
                ))}
            </div>

            {/* Empty State Overlay */}
            {geoCount === 0 && filteredClusters.length === 0 && (
                <div className="absolute inset-0 z-[1001] bg-black/40 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
                    <div className="text-center p-6 bg-zinc-900/80 rounded-2xl border border-zinc-800 shadow-2xl">
                        <div className="text-4xl mb-3">🌍</div>
                        <p className="text-sm font-semibold text-zinc-200">Sin datos geográficos</p>
                        <p className="text-xs text-zinc-500 mt-1">Los eventos aparecerán cuando tengan coordenadas</p>
                    </div>
                </div>
            )}

            <style>{`
                .leaflet-container {
                    cursor: crosshair !important;
                }
                .custom-popup-manual .leaflet-popup-content-wrapper {
                    background: ${theme === 'dark' ? '#18181b' : '#ffffff'} !important;
                    color: ${theme === 'dark' ? 'white' : '#18181b'} !important;
                    border-radius: 8px !important;
                    border: 1px solid ${theme === 'dark' ? '#3f3f46' : '#e4e4e7'} !important;
                    padding: 0 !important;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
                }
                .map-popup-title {
                    font-weight: bold; font-size: 12px; margin: 0 0 4px 0;
                    color: ${theme === 'dark' ? '#f4f4f5' : '#18181b'};
                }
                .map-popup-subtitle {
                    font-size: 10px; color: ${theme === 'dark' ? '#a1a1aa' : '#71717a'}; margin: 0; text-transform: capitalize;
                }
                .custom-popup-manual .leaflet-popup-content {
                    margin: 8px !important;
                }
                .custom-popup-manual .leaflet-popup-tip {
                    background: ${theme === 'dark' ? '#18181b' : '#ffffff'} !important;
                }
                .leaflet-div-icon {
                    background: transparent !important;
                    border: none !important;
                }
            `}</style>
        </div>
    );
}
