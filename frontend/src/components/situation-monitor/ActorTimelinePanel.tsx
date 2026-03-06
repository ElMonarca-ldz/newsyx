import React, { useEffect, useState } from 'react';
import { useSituationMonitorStore } from '@/stores/situationMonitorStore';
import { fetchActorTimeline } from '@/api/actors';
import { Calendar, Newspaper, ExternalLink, Clock, ChevronRight, Loader2, ArrowLeft, Users } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export function ActorTimelinePanel() {
    const { selectedActorSlug, actorTimeline, setActorTimeline, selectArticleForExplorer, selectActor } = useSituationMonitorStore();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (selectedActorSlug) {
            setLoading(true);
            fetchActorTimeline(selectedActorSlug)
                .then(data => {
                    setActorTimeline(data);
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [selectedActorSlug, setActorTimeline]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[500px] space-y-6 animate-in fade-in duration-500">
                <div className="relative">
                    <div className="absolute -inset-4 bg-emerald-500/20 rounded-full blur-xl animate-pulse" />
                    <Loader2 className="w-12 h-12 text-emerald-500 animate-spin relative" />
                </div>
                <div className="text-center">
                    <p className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Reconstruyendo Perspectiva</p>
                    <p className="text-sm text-zinc-500">Sincronizando eventos y sub-eventos para {selectedActorSlug?.replace(/-/g, ' ')}</p>
                </div>
            </div>
        );
    }

    if (!actorTimeline || actorTimeline.length === 0) {
        return (
            <div className="h-[500px] flex flex-col items-center justify-center p-8 text-center space-y-6">
                <div className="p-10 bg-zinc-100 dark:bg-zinc-900 rounded-[3rem] border border-dashed border-zinc-300 dark:border-zinc-800">
                    <Users className="w-16 h-16 text-zinc-300 dark:text-zinc-700" />
                </div>
                <div className="space-y-2">
                    <p className="text-xl font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight italic">Sin registros</p>
                    <p className="text-sm text-zinc-500 max-w-xs">No hemos detectado menciones adicionales de este actor en nuestra base de datos actual.</p>
                </div>
                <button
                    onClick={() => selectActor(null)}
                    className="flex items-center gap-2 px-6 py-2 bg-zinc-900 dark:bg-white dark:text-black text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
                >
                    <ArrowLeft className="w-4 h-4" /> Volver al Análisis
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header / Navigation */}
            <div className="flex items-center justify-between sticky top-0 z-20 bg-[#F8FAFC]/80 dark:bg-[#020617]/80 backdrop-blur-md py-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => selectActor(null)}
                        className="p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-600 transition-all shadow-sm group"
                        title="Volver al análisis"
                    >
                        <ArrowLeft className="w-5 h-5 group-active:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none italic">
                            Perspectiva: {selectedActorSlug?.replace(/-/g, ' ')}
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Cronología de impacto</span>
                            <span className="w-1 h-1 rounded-full bg-zinc-400" />
                            <span className="text-[10px] font-bold text-zinc-500 uppercase">{actorTimeline.length} Noticias detectadas</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Timeline Layout */}
            <div className="relative pl-8 space-y-12 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-1 before:bg-gradient-to-b before:from-emerald-500 before:via-emerald-500/50 before:to-transparent before:rounded-full">
                {actorTimeline.map((art, idx) => (
                    <div key={idx} className="relative">
                        {/* Timeline Marker */}
                        <div className="absolute -left-[35px] top-1.5 w-6 h-6 rounded-full border-4 border-[#F8FAFC] dark:border-[#020617] bg-white dark:bg-zinc-900 flex items-center justify-center shadow-lg z-10 transition-transform group-hover:scale-110">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        </div>

                        {/* Date Float */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="px-3 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm">
                                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                    {new Date(art.fechaPublicacion || art.fechaExtraccion).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
                                </span>
                            </div>
                            {art.event && (
                                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-tighter italic">
                                        EVENTO: {art.event.titulo}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Article Card - Dashboard Style */}
                        <Card
                            onClick={() => selectArticleForExplorer(art.slug || art.id)}
                            className="overflow-hidden border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/50 transition-all cursor-pointer shadow-xl hover:shadow-2xl bg-white dark:bg-slate-950/40 backdrop-blur-sm group"
                        >
                            <CardContent className="p-0 flex flex-col md:flex-row">
                                {art.imagenUrl && (
                                    <div className="w-full md:w-48 h-32 md:h-auto overflow-hidden shrink-0 border-r border-zinc-100 dark:border-zinc-800">
                                        <img src={art.imagenUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={art.titular} />
                                    </div>
                                )}
                                <div className="p-6 flex-1 space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="p-1 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-500">
                                                <Newspaper className="w-3 h-3" />
                                            </span>
                                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{art.fuente}</span>
                                        </div>
                                        <h4 className="text-xl font-black text-slate-800 dark:text-slate-100 leading-tight group-hover:text-emerald-500 transition-colors italic">
                                            {art.titular}
                                        </h4>
                                    </div>

                                    {/* Sub-events Hierarchy - Premium Integration */}
                                    {art.relevantEvents && art.relevantEvents.length > 0 && (
                                        <div className="space-y-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                            <div className="flex items-center gap-2">
                                                <div className="h-0.5 w-6 bg-emerald-500 rounded-full" />
                                                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Hechos de Interés</span>
                                            </div>
                                            <div className="grid grid-cols-1 gap-2">
                                                {art.relevantEvents.map((ev: any, evIdx: number) => (
                                                    <div key={evIdx} className="flex items-start gap-3 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 group/ev cursor-default">
                                                        <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                                                            <ChevronRight className="w-3 h-3 text-emerald-500" />
                                                        </div>
                                                        <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium italic">
                                                            "{ev.descripcion}"
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-2 flex items-center justify-between">
                                        <div className="flex gap-2">
                                            {art.scoreDesin > 0.4 && (
                                                <span className="px-2 py-0.5 bg-rose-500/10 text-rose-500 text-[9px] font-black rounded border border-rose-500/20">RIESGO DESIN</span>
                                            )}
                                            {art.scoreCalidad > 0.7 && (
                                                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[9px] font-black rounded border border-emerald-500/20">ALTA CALIDAD</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                            Explorar Análisis <ArrowLeft className="w-3 h-3 rotate-180" />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                ))}
            </div>

            <div className="pt-20 pb-10 text-center">
                <button
                    onClick={() => selectActor(null)}
                    className="px-10 py-4 bg-zinc-900 dark:bg-white dark:text-black text-white rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-2xl"
                >
                    Volver al Dashboard
                </button>
            </div>
        </div>
    );
}
