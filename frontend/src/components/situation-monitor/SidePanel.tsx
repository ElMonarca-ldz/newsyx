import { useSituationMonitorStore } from '@/stores/situationMonitorStore';
import type { SituationEvent, EventCluster } from '@/types/situation-monitor';
import { X, ExternalLink, MapPin, Calendar, Users, Tag, AlertTriangle, Share2, Boxes } from 'lucide-react';
import { FocalPointsPanel } from './FocalPointsPanel';
import { ShareStoryModal } from './ShareStoryModal';
import { useState, useMemo } from 'react';

export function SidePanel() {
    const {
        data, closeSidePanel, sidePanelContent,
        selectedEventId, selectedClusterId, filteredEventos,
        selectEvent, setShareModalOpen, selectArticleForExplorer,
        theme
    } = useSituationMonitorStore();

    const [eventToShare, setEventToShare] = useState<string | null>(null);

    const selectedEvent = useMemo(() => {
        if (!selectedEventId || !filteredEventos) return null;
        return filteredEventos.find(e => `${e.articulo.id}-${e.id}` === selectedEventId) || null;
    }, [selectedEventId, filteredEventos]);

    const selectedCluster = useMemo(() => {
        if (!selectedClusterId || !data?.clusters) return null;
        return data.clusters.find(c => c.id === selectedClusterId) || null;
    }, [selectedClusterId, data?.clusters]);

    const convergingEvents = useMemo(() => {
        if (!selectedEvent || !data?.clusters) return [];
        const cluster = data.clusters.find((c: EventCluster) => c.id === selectedEvent.cluster_id);
        if (!cluster) return [];

        const seenTitles = new Set([selectedEvent.articulo.titulo.toLowerCase()]);
        const seenMedios = new Set([selectedEvent.articulo.medio]);

        return cluster.eventos
            .filter((ev: SituationEvent) =>
                ev.articulo.id !== selectedEvent.articulo.id &&
                !seenMedios.has(ev.articulo.medio)
            )
            .filter((ev: SituationEvent) => {
                const title = ev.articulo.titulo.toLowerCase();
                if (seenTitles.has(title)) return false;

                // Relevance check: must share at least one actor with selected event
                const hasSharedActor = ev.actores_resueltos.some((a: any) =>
                    selectedEvent.actores_resueltos.some((sa: any) => sa.slug === a.slug)
                );

                if (hasSharedActor) {
                    seenTitles.add(title);
                    seenMedios.add(ev.articulo.medio);
                    return true;
                }
                return false;
            })
            .slice(0, 5);
    }, [selectedEvent, data?.clusters]);

    if (!data) return null;

    return (
        <div className="h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-700 flex flex-col overflow-hidden">
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b transition-colors ${theme === 'dark' ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50'}`}>
                <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                    {sidePanelContent === 'event' ? 'Detalle del evento'
                        : sidePanelContent === 'cluster' ? 'Cluster de eventos'
                            : 'Detalle'}
                </span>
                <button
                    onClick={closeSidePanel}
                    className="p-1 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Event detail */}
                {selectedEvent && (
                    <>
                        {selectedEvent.articulo.imagen && (
                            <div className="relative w-full h-40 rounded-2xl overflow-hidden border border-zinc-800 shadow-lg mb-4 bg-zinc-950">
                                <img
                                    src={selectedEvent.articulo.imagen}
                                    alt={selectedEvent.articulo.titulo}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/80 to-transparent" />
                            </div>
                        )}
                        <div>
                            <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-100 leading-snug mb-2">
                                {selectedEvent.descripcion}
                            </h3>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                                <span className={`text-xs px-2 py-0.5 rounded-md font-medium border ${selectedEvent.certeza_evento === 'confirmado' ? 'bg-green-900/40 text-green-400 border-green-700/50'
                                    : selectedEvent.certeza_evento === 'inferido' ? 'bg-amber-900/40 text-amber-400 border-amber-700/50'
                                        : 'bg-indigo-900/40 text-indigo-400 border-indigo-700/50'
                                    }`}>
                                    {selectedEvent.certeza_evento}
                                </span>
                                {selectedEvent.es_hecho_central && (
                                    <span className="text-xs px-2 py-0.5 rounded-md bg-red-900/30 text-red-400 border border-red-800/50">
                                        ★ Hecho Central
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Meta */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-zinc-400">
                                <Calendar className="w-4 h-4 text-zinc-500" />
                                <span>
                                    {selectedEvent.fecha_exacta
                                        ? new Date(selectedEvent.fecha_exacta).toLocaleDateString('es', { dateStyle: 'full' })
                                        : selectedEvent.fecha_aproximada || 'Fecha no determinada'}
                                </span>
                                {selectedEvent.confianza_fecha < 0.7 && (
                                    <span className="text-xs text-zinc-600">
                                        (confianza: {(selectedEvent.confianza_fecha * 100).toFixed(0)}%)
                                    </span>
                                )}
                            </div>

                            {selectedEvent.lugar && (
                                <div className="flex items-center gap-2 text-sm text-zinc-400">
                                    <MapPin className="w-4 h-4 text-zinc-500" />
                                    <span>{selectedEvent.lugar.nombre_display}</span>
                                    <span className="text-xs text-zinc-600">({selectedEvent.lugar.tipo})</span>
                                </div>
                            )}

                            {selectedEvent.actores_resueltos.length > 0 && (
                                <div className="flex items-start gap-2 text-sm text-zinc-400">
                                    <Users className="w-4 h-4 text-zinc-500 mt-0.5" />
                                    <div className="flex flex-wrap gap-1">
                                        {selectedEvent.actores_resueltos.map(a => (
                                            <span key={a.slug} className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs border border-zinc-300 dark:border-zinc-700/50">
                                                {a.label}
                                                <span className="text-zinc-500 ml-1">· {a.tipo}</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedEvent.tags_tematicos.length > 0 && (
                                <div className="flex items-start gap-2 text-sm text-zinc-400">
                                    <Tag className="w-4 h-4 text-zinc-500 mt-0.5" />
                                    <div className="flex flex-wrap gap-1">
                                        {selectedEvent.tags_tematicos.map(t => (
                                            <span key={t} className="px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs">
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Convergence Badge & Info */}
                        {selectedEvent.es_convergente && (
                            <div className="mt-4 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="p-2 bg-emerald-500/20 rounded-xl">
                                        <Boxes className="w-4 h-4 text-emerald-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-tight">Validación Multi-Fuente</h4>
                                        <p className="text-[10px] text-zinc-500 uppercase font-medium">Evento Confirmado por diversos medios</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {convergingEvents.map((e, i) => (
                                        <div key={i} className="flex flex-col gap-1 p-2.5 bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800/50 hover:border-emerald-500/30 transition-all cursor-pointer group"
                                            onClick={() => selectArticleForExplorer(e.articulo.id)}>
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 truncate">{e.articulo.medio}</span>
                                                <ExternalLink className="w-3 h-3 text-zinc-400 dark:text-zinc-600 group-hover:text-emerald-400 transition-colors" />
                                            </div>
                                            <p className="text-[11px] text-zinc-900 dark:text-zinc-200 line-clamp-1 leading-tight">{e.articulo.titulo}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Evidence */}
                        <div className="mt-3 p-3 bg-zinc-100 dark:bg-zinc-800/40 rounded-lg border border-zinc-200 dark:border-zinc-700/40">
                            <p className="text-xs text-zinc-500 mb-1 font-medium">Fragmento de evidencia</p>
                            <p className="text-sm text-zinc-700 dark:text-zinc-300 italic leading-relaxed">
                                "{selectedEvent.fragmento_evidencia}"
                            </p>
                        </div>

                        {/* Article info */}
                        <div className="p-3 bg-zinc-100 dark:bg-zinc-800/40 rounded-lg border border-zinc-200 dark:border-zinc-700/40">
                            <p className="text-xs text-zinc-500 mb-2 font-medium">Artículo fuente</p>
                            <p className="text-sm text-zinc-200 font-medium mb-1">{selectedEvent.articulo.titulo}</p>
                            <p className="text-xs text-zinc-400 mb-2">{selectedEvent.articulo.medio}</p>
                            <div className="flex items-center gap-3 text-xs">
                                {selectedEvent.articulo.scoreDesin > 0.4 && (
                                    <span className="flex items-center gap-1 text-amber-400">
                                        <AlertTriangle className="w-3 h-3" />
                                        Riesgo: {(selectedEvent.articulo.scoreDesin * 100).toFixed(0)}%
                                    </span>
                                )}
                                <button
                                    onClick={() => selectArticleForExplorer(selectedEvent.articulo.slug || selectedEvent.articulo.id)}
                                    className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
                                >
                                    Ir a Explorar <ExternalLink className="w-3 h-3" />
                                </button>
                                <button
                                    onClick={() => setEventToShare(selectedEvent.articulo.slug || selectedEvent.articulo.id)}
                                    className="flex items-center gap-1 text-emerald-500 hover:text-emerald-400 ml-auto"
                                >
                                    Compartir <Share2 className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {/* Cluster detail */}
                {selectedCluster && (
                    <>
                        <div>
                            <h3 className="text-base font-semibold text-zinc-100 leading-snug mb-2">
                                {selectedCluster.label_resumen}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-zinc-400 mb-3">
                                <span className="text-lg font-bold text-emerald-400">{selectedCluster.eventos.length}</span>
                                <span>eventos agrupados</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-zinc-400">
                                <Calendar className="w-4 h-4 text-zinc-500" />
                                <span>{selectedCluster.rango_temporal.desde} — {selectedCluster.rango_temporal.hasta}</span>
                            </div>
                        </div>

                        {selectedCluster.tags_dominantes.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {selectedCluster.tags_dominantes.map(t => (
                                    <span key={t} className="px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400 text-xs border border-emerald-700/50">
                                        {t}
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <p className="text-xs text-zinc-500 font-medium">Eventos del cluster</p>
                            {selectedCluster.eventos.map((ev: any, i: number) => (
                                <button
                                    key={i}
                                    onClick={() => selectEvent(`${ev.articulo.id}-${ev.id}`)}
                                    className="w-full text-left p-2.5 bg-zinc-800/30 hover:bg-zinc-800/60 rounded-lg border border-zinc-700/40 hover:border-emerald-500/40 text-sm text-zinc-300 transition-all group"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${ev.certeza_evento === 'confirmado' ? 'bg-green-500' : 'bg-amber-500'}`} />
                                        <span className="flex-1 truncate">{ev.descripcion}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {/* No selection - Dashboard Mode */}
                {!selectedEvent && !selectedCluster && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom duration-500">
                        <FocalPointsPanel />
                        <div className="p-4 bg-zinc-100 dark:bg-zinc-950/20 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                            <h4 className="text-[10px] font-black uppercase text-zinc-500 mb-2">Instrucciones</h4>
                            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                                Selecciona un marcador en el mapa o un evento del feed para ver detalles específicos, actores involucrados y evidencia.
                            </p>
                            <button
                                onClick={() => setShareModalOpen(true)}
                                className="w-full py-2.5 flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all"
                            >
                                <Share2 className="w-4 h-4" />
                                Compartir Briefing Diario
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <ShareStoryModal
                isOpen={!!eventToShare}
                onClose={() => setEventToShare(null)}
                analysisId={eventToShare || undefined}
            />
        </div>
    );
}
