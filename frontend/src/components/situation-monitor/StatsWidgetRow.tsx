import { useSituationMonitorStore } from '@/stores/situationMonitorStore';
import { Activity, MapPin, Users, AlertTriangle, Newspaper } from 'lucide-react';
import { config } from '@/config/variants';

export function StatsWidgetRow() {
    const { data, filteredEventos, unreadAlertsCount, markAlertsRead, theme } = useSituationMonitorStore();

    if (!data) return <div className={`h-20 border-b animate-pulse ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`} />;

    // Derived stats from filtered data
    const filteredStats = {
        total_eventos: filteredEventos.length,
        total_lugares: new Set(filteredEventos.map((e: any) => e.lugar?.slug).filter(Boolean)).size,
        total_actores: new Set(filteredEventos.flatMap((e: any) => e.actores_resueltos.map((a: any) => a.slug))).size,
        alertas_criticas: data.stats.alertas_criticas, // Assuming alerts are not filtered by the same logic yet or should remain global
        articulos_en_ventana: new Set(filteredEventos.map((e: any) => e.articulo.id)).size,
        anomalias_detectadas: data.stats.anomalias_detectadas,
    };

    const widgets = [
        {
            id: 'eventos',
            label: 'Eventos activos',
            value: filteredStats.total_eventos,
            icon: <Activity className="w-4 h-4 text-blue-400" />,
            color: 'text-blue-400',
            gradFrom: 'from-blue-500/10',
        },
        {
            id: 'lugares',
            label: 'Lugares',
            value: filteredStats.total_lugares,
            icon: <MapPin className="w-4 h-4 text-emerald-400" />,
            color: 'text-emerald-400',
            gradFrom: 'from-emerald-500/10',
        },
        {
            id: 'actores',
            label: 'Actores',
            value: filteredStats.total_actores,
            icon: <Users className="w-4 h-4 text-violet-400" />,
            color: 'text-violet-400',
            gradFrom: 'from-violet-500/10',
        },
        {
            id: 'alertas',
            label: 'Alertas críticas',
            value: filteredStats.alertas_criticas,
            badge: unreadAlertsCount > 0 ? unreadAlertsCount : undefined,
            icon: <AlertTriangle className="w-4 h-4 text-red-400" />,
            color: filteredStats.alertas_criticas > 0 ? 'text-red-400' : 'text-zinc-400',
            gradFrom: filteredStats.alertas_criticas > 0 ? 'from-red-500/10' : 'from-zinc-500/5',
            onClick: () => { markAlertsRead(); },
        },
        {
            id: 'articulos',
            label: 'Artículos',
            value: filteredStats.articulos_en_ventana,
            icon: <Newspaper className="w-4 h-4 text-zinc-400" />,
            color: theme === 'dark' ? 'text-zinc-300' : 'text-zinc-600',
            gradFrom: 'from-zinc-500/5',
        },
        {
            id: 'anomalias',
            label: 'Anomalías',
            value: filteredStats.anomalias_detectadas,
            badge: filteredStats.anomalias_detectadas > 0 ? filteredStats.anomalias_detectadas : undefined,
            icon: <Activity className="w-4 h-4 text-orange-400" />,
            color: filteredStats.anomalias_detectadas > 0 ? 'text-orange-400' : 'text-zinc-500',
            gradFrom: filteredStats.anomalias_detectadas > 0 ? 'from-orange-500/10' : 'from-zinc-500/5',
        },
    ].filter(w => {
        if (w.id === 'anomalias') return config.features.itlScore;
        return true;
    });

    return (
        <div className="flex items-center gap-3 flex-nowrap overflow-visible">
            {widgets.map(w => (
                <div
                    key={w.id}
                    onClick={'onClick' in w ? w.onClick : undefined}
                    className={`
                        relative flex items-center gap-1.5 px-2 py-1 rounded-md
                        transition-all group
                        ${'onClick' in w ? `cursor-pointer ${theme === 'dark' ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-100'}` : ''}
                    `}
                    title={w.label}
                >
                    <div className="flex items-center gap-1.5">
                        <div className={`transition-colors ${theme === 'dark' ? 'text-zinc-500 group-hover:text-zinc-400' : 'text-zinc-400 group-hover:text-zinc-600'}`}>
                            {w.icon}
                        </div>
                        <span className={`text-sm font-bold leading-none ${w.color}`}>
                            {w.value.toLocaleString()}
                        </span>
                    </div>
                    {'badge' in w && w.badge !== undefined && w.badge > 0 && (
                        <span className={`absolute -top-1 -right-1 min-w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center font-black animate-pulse shadow-sm ${theme === 'dark' ? 'ring-1 ring-zinc-900' : 'ring-1 ring-white'}`}>
                            {w.badge > 99 ? '99+' : w.badge}
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
}
