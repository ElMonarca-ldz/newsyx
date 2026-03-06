import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Share2, Layers } from 'lucide-react';
import { EventCard } from './EventCard';
import type { SituationEvent } from '@/types/situation-monitor';
import { useSituationMonitorStore } from '@/stores/situationMonitorStore';

interface EventHierarchyGroupProps {
    eventos: SituationEvent[];
}

export function EventHierarchyGroup({ eventos }: EventHierarchyGroupProps) {
    const { selectedEventId, selectEvent, hoveredGeoSlug, theme } = useSituationMonitorStore();
    const [isExpanded, setIsExpanded] = useState(false);

    if (eventos.length === 0) return null;

    if (eventos.length === 1) {
        const evento = eventos[0];
        return (
            <EventCard
                evento={evento}
                isSelected={selectedEventId === `${evento.articulo.id}-${evento.id}`}
                isGeoHighlighted={hoveredGeoSlug === evento.lugar?.slug}
                onSelect={() => selectEvent(`${evento.articulo.id}-${evento.id}`)}
            />
        );
    }

    // Identify central event (es_hecho_central = true, or first)
    const centralEvent = eventos.find(e => e.es_hecho_central) || eventos[0];
    const subEvents = eventos.filter(e => e.id !== centralEvent.id);

    return (
        <div className={`mb-2 rounded-lg border overflow-hidden relative transition-colors ${theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-zinc-50 border-zinc-200 shadow-sm'}`}>
            <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition-colors ${theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50' : 'bg-white border-zinc-200'}`}>
                    <Layers className="w-3 h-3 text-emerald-400" />
                    <span className={`text-[10px] uppercase font-bold ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-600'}`}>{subEvents.length + 1} Eventos</span>
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(!isExpanded);
                    }}
                    className={`p-1 rounded transition-colors ${theme === 'dark' ? 'hover:bg-zinc-700/50 text-zinc-400 bg-zinc-800/80' : 'hover:bg-zinc-200 text-zinc-500 bg-white shadow-sm border border-zinc-200'}`}
                >
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
            </div>

            <EventCard
                evento={centralEvent}
                isSelected={selectedEventId === `${centralEvent.articulo.id}-${centralEvent.id}`}
                isGeoHighlighted={hoveredGeoSlug === centralEvent.lugar?.slug}
                onSelect={() => {
                    selectEvent(`${centralEvent.articulo.id}-${centralEvent.id}`);
                    if (!isExpanded) setIsExpanded(true);
                }}
            />

            {isExpanded && (
                <div className={`pl-6 pr-2 pb-2 relative space-y-1.5 border-t pt-3 mt-[-4px] ${theme === 'dark' ? 'border-zinc-800/50 bg-zinc-950/30' : 'border-zinc-200 bg-zinc-100/30'}`}>
                    <div className="absolute left-[19px] top-0 bottom-4 w-px bg-gradient-to-b from-zinc-300 dark:from-zinc-700 to-transparent" />
                    {subEvents.map(subEvent => (
                        <div key={subEvent.id} className="relative">
                            <div className="absolute -left-4 top-5 w-3 h-px border-t border-zinc-700 border-dashed" />
                            <EventCard
                                evento={subEvent}
                                isSelected={selectedEventId === `${subEvent.articulo.id}-${subEvent.id}`}
                                isGeoHighlighted={hoveredGeoSlug === subEvent.lugar?.slug}
                                onSelect={() => selectEvent(`${subEvent.articulo.id}-${subEvent.id}`)}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

