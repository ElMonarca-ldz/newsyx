import { useMemo } from 'react';
import { useSituationMonitorStore } from '@/stores/situationMonitorStore';
import { EventHierarchyGroup } from '@/components/situation-monitor/EventHierarchyGroup';
import { MapPin, Users, Clock } from 'lucide-react';
import type { SituationEvent } from '@/types/situation-monitor';
import { motion, AnimatePresence } from 'framer-motion';

export function EventFeed() {
    const { filteredEventos, feedGroupBy, setFeedGroupBy, theme } = useSituationMonitorStore();

    // Group events by target criteria (reverse chronological by default)
    const grouped = useMemo(() => {
        // Sort strictly by publication date (descending)
        const sorted = [...filteredEventos].sort((a, b) => {
            const dateA = a.articulo.fecha_publicacion || a.fecha_exacta || '';
            const dateB = b.articulo.fecha_publicacion || b.fecha_exacta || '';
            if (dateB !== dateA) return dateB.localeCompare(dateA);
            // Tie-break with ID to keep stable sort
            return (b.id || 0) - (a.id || 0);
        });

        if (feedGroupBy === 'lugar') {
            const groups = new Map<string, SituationEvent[]>();
            for (const e of sorted) {
                const key = e.lugar?.nombre_display || 'Sin ubicación';
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(e);
            }
            return Array.from(groups.entries()).map(([label, items]) => ({ key: label, label, items }));
        }

        if (feedGroupBy === 'actor') {
            const groups = new Map<string, SituationEvent[]>();
            for (const e of sorted) {
                const key = e.actores_resueltos[0]?.label || 'Sin actor';
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(e);
            }
            return Array.from(groups.entries()).map(([label, items]) => ({ key: label, label, items }));
        }

        // Default: tiempo
        return [{ key: 'all', label: `${sorted.length} eventos`, items: sorted }];
    }, [filteredEventos, feedGroupBy]);

    const groupButtons = [
        { id: 'tiempo' as const, icon: Clock, label: 'Tiempo' },
        { id: 'lugar' as const, icon: MapPin, label: 'Lugar' },
        { id: 'actor' as const, icon: Users, label: 'Actor' },
    ];

    return (
        <div className={`flex flex-col h-full overflow-hidden ${theme === 'dark' ? 'bg-zinc-950' : 'bg-white'}`}>
            {/* Toolbar */}
            <div className={`flex items-center gap-1.5 px-3 py-2 border-b transition-colors z-10 ${theme === 'dark' ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-zinc-50'}`}>
                <span className="text-xs text-zinc-500 mr-2">Agrupar por:</span>
                {groupButtons.map(btn => (
                    <button
                        key={btn.id}
                        onClick={() => setFeedGroupBy(btn.id)}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${feedGroupBy === btn.id
                            ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 font-bold'
                            : `${theme === 'dark' ? 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'}`
                            }`}
                    >
                        <btn.icon className="w-3 h-3" />
                        {btn.label}
                    </button>
                ))}
                <span className="ml-auto text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                    {filteredEventos.length} EVENTOS
                </span>
            </div>

            {/* Event list */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 custom-scrollbar">
                <AnimatePresence mode="popLayout" initial={false}>
                    {grouped.map((group) => (
                        <motion.div
                            key={group.key}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                        >
                            {feedGroupBy !== 'tiempo' && (
                                <div className="flex items-center gap-2 py-2 px-1 sticky top-0 bg-inherit z-[5]">
                                    <div className="w-1 h-3.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                    <span className="text-[10px] font-black uppercase text-zinc-500 tracking-tighter">{group.label}</span>
                                    <span className="text-[10px] text-zinc-600 font-bold">({group.items.length})</span>
                                </div>
                            )}

                            {(() => {
                                const articleGroups = new Map<string, SituationEvent[]>();
                                for (const evento of group.items) {
                                    const key = evento.articulo.id;
                                    if (!articleGroups.has(key)) articleGroups.set(key, []);
                                    articleGroups.get(key)!.push(evento);
                                }

                                return Array.from(articleGroups.entries()).map(([articleId, eventosDelArticulo]) => (
                                    <motion.div
                                        key={articleId}
                                        layout
                                        className="mb-1"
                                    >
                                        <EventHierarchyGroup
                                            eventos={eventosDelArticulo}
                                        />
                                    </motion.div>
                                ));
                            })()}
                        </motion.div>
                    ))}
                </AnimatePresence>

                {(grouped.length === 0 || (grouped.length === 1 && grouped[0].items.length === 0)) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center h-64 text-zinc-500"
                    >
                        <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mb-4 border border-zinc-800">
                            <Clock className="w-6 h-6 text-zinc-700" />
                        </div>
                        <p className="text-xs font-medium uppercase tracking-widest">Sin eventos para mostrar</p>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
