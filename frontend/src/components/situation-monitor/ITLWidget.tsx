import { useQuery } from '@tanstack/react-query';
import { useSituationMonitorStore } from '@/stores/situationMonitorStore';
import { fetchCurrentITL } from '@/api/itl';
import { TrendingUp, TrendingDown, Minus, Info, AlertTriangle, ShieldAlert } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '@/components/ui/tooltip';

export function ITLWidget() {
    const { theme } = useSituationMonitorStore();
    const { data, isLoading, isError } = useQuery({
        queryKey: ['itl-score', 'AR'],
        queryFn: () => fetchCurrentITL('AR'),
        refetchInterval: 1000 * 60 * 15, // 15 minutes
    });

    if (isLoading || isError || !data || !data.components) return null;

    const { score, trend, components, topDrivers } = data;

    const getScoreColor = (s: number) => {
        if (s < 30) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
        if (s < 55) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
        if (s < 75) return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
        return 'text-red-400 bg-red-500/10 border-red-500/20';
    };

    const getTrendIcon = (t: string) => {
        if (t === 'up') return <TrendingUp className="w-3 h-3 text-red-400" />;
        if (t === 'down') return <TrendingDown className="w-3 h-3 text-emerald-400" />;
        return <Minus className="w-3 h-3 text-zinc-500" />;
    };

    const StatusIcon = score > 60 ? AlertTriangle : ShieldAlert;

    return (
        <TooltipProvider>
            <div className="group relative">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className={`
                            flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-help
                            ${getScoreColor(score)}
                        `}>
                            <div className="flex items-center gap-1.5 uppercase tracking-wider font-bold text-[10px]">
                                <span className="opacity-70">ITL Index</span>
                                <span className="text-sm tracking-tight">{score}</span>
                            </div>
                            <div className="h-3 w-px bg-current opacity-20 mx-0.5" />
                            {getTrendIcon(trend)}
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className={`w-[280px] border transition-colors ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-xl'}`}>
                        <div className="space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className={`font-bold italic text-sm ${theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'}`}>Índice de Tensión LATAM</p>
                                    <p className="text-[10px] text-zinc-500">Basado en análisis de las últimas 24h</p>
                                </div>
                                <div className={`text-lg font-black ${getScoreColor(score).split(' ')[0]}`}>
                                    {score}%
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Componentes</p>
                                <div className="grid grid-cols-2 gap-2 text-[10px]">
                                    <div className={`flex justify-between p-1.5 rounded ${theme === 'dark' ? 'bg-zinc-800/40' : 'bg-zinc-100'}`}>
                                        <span className="text-zinc-500">Desinformación</span>
                                        <span className={`${theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'} font-medium`}>{Math.round((components?.desinformacion || 0) * 100)}%</span>
                                    </div>
                                    <div className={`flex justify-between p-1.5 rounded ${theme === 'dark' ? 'bg-zinc-800/40' : 'bg-zinc-100'}`}>
                                        <span className="text-zinc-500">Negatividad</span>
                                        <span className={`${theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'} font-medium`}>{Math.round((components?.negatividad || 0) * 100)}%</span>
                                    </div>
                                    <div className={`flex justify-between p-1.5 rounded ${theme === 'dark' ? 'bg-zinc-800/40' : 'bg-zinc-100'}`}>
                                        <span className="text-zinc-500">Sesgo</span>
                                        <span className={`${theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'} font-medium`}>{Math.round((components?.sesgo || 0) * 100)}%</span>
                                    </div>
                                    <div className={`flex justify-between p-1.5 rounded ${theme === 'dark' ? 'bg-zinc-800/40' : 'bg-zinc-100'}`}>
                                        <span className="text-zinc-500">Tensión Geoloc.</span>
                                        <span className={`${theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'} font-medium`}>{Math.round((components?.tension_eventos || 0) * 100)}%</span>
                                    </div>
                                </div>
                            </div>

                            {topDrivers && topDrivers.length > 0 && (
                                <div className="space-y-1.5 pt-1 border-t border-zinc-800">
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Principales Inductores</p>
                                    <ul className="space-y-1">
                                        {topDrivers.map((d: string, i: number) => (
                                            <li key={i} className="text-[10px] leading-tight text-zinc-300 flex gap-2">
                                                <span className="text-zinc-600 font-mono">•</span>
                                                {d}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="flex items-center gap-2 pt-1.5 text-[9px] text-zinc-500">
                                <Info className="w-2.5 h-2.5" />
                                <span>Actualizado hace: {new Date().getMinutes()}m</span>
                            </div>
                        </div>
                    </TooltipContent>
                </Tooltip>
            </div>
        </TooltipProvider>
    );
}
