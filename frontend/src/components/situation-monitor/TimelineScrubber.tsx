import { useSituationMonitorStore } from '@/stores/situationMonitorStore';
import { useMemo } from 'react';

export function TimelineScrubber() {
    const { data, filters, setFilters } = useSituationMonitorStore();

    const eventsByDay = useMemo(() => {
        if (!data) return [];
        const counts = new Map<string, number>();
        for (const e of data.eventos) {
            const d = e.fecha_exacta?.split('T')[0] || e.articulo.fecha_publicacion?.split('T')[0];
            if (d) counts.set(d, (counts.get(d) ?? 0) + 1);
        }
        return Array.from(counts.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, count]) => ({ date, count }));
    }, [data]);

    if (eventsByDay.length === 0) return null;

    const maxCount = Math.max(...eventsByDay.map(e => e.count), 1);
    const selectedDesde = filters.fechaDesde?.split('T')[0];
    const selectedHasta = filters.fechaHasta?.split('T')[0];

    return (
        <div className="flex items-end gap-px px-4 py-2 h-16 bg-zinc-900/80 border-t border-zinc-800 overflow-x-auto flex-shrink-0">
            {eventsByDay.map(({ date, count }) => {
                const height = Math.max(6, (count / maxCount) * 40);
                const isInRange =
                    (!selectedDesde || date >= selectedDesde) &&
                    (!selectedHasta || date <= selectedHasta);

                return (
                    <div
                        key={date}
                        onClick={() => {
                            if (filters.fechaDesde === date && filters.fechaHasta === date) {
                                setFilters({ fechaDesde: null, fechaHasta: null });
                            } else {
                                setFilters({ fechaDesde: date, fechaHasta: date });
                            }
                        }}
                        className="group flex flex-col items-center cursor-pointer relative"
                        style={{ minWidth: Math.max(8, eventsByDay.length < 30 ? 600 / eventsByDay.length : 8) }}
                    >
                        <div
                            className={`w-full rounded-sm transition-all duration-150 ${isInRange
                                    ? 'bg-emerald-500/70 group-hover:bg-emerald-400'
                                    : 'bg-zinc-700/50 group-hover:bg-zinc-600/60'
                                }`}
                            style={{ height: `${height}px` }}
                        />
                        {/* Date tooltip */}
                        <div className="absolute -top-8 bg-zinc-800 text-zinc-300 text-xs px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-30 shadow">
                            {new Date(date + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })} · {count}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
