import React from 'react';
import { useSituationMonitorStore } from '@/stores/situationMonitorStore';
import { useQuery } from '@tanstack/react-query';
import { Target, TrendingUp, User, MapPin } from 'lucide-react';

interface FocalPoint {
    name: string;
    type: 'actor' | 'location';
    score: number;
    mentions: number;
    trend: 'emerging' | 'stable';
    signals: {
        sentiment: number;
        alarmism: number;
    };
}

export const FocalPointsPanel: React.FC = () => {
    const { setFilters, theme } = useSituationMonitorStore();
    const { data: focalPoints, isLoading } = useQuery<FocalPoint[]>({
        queryKey: ['focal-points'],
        queryFn: () => fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/situation-monitor/focal-points?country=AR`).then(res => res.json()),
        refetchInterval: 600000, // Cada 10 minutos
    });

    const handlePointClick = (fp: FocalPoint) => {
        if (fp.type === 'actor') {
            setFilters({ actoresIds: [fp.name] }); // Assuming name matches slug or label
        } else {
            setFilters({ lugaresIds: [fp.name] });
        }
    };

    if (isLoading || !focalPoints || focalPoints.length === 0) return null;

    return (
        <div className={`border rounded-2xl p-4 backdrop-blur-md animate-in fade-in slide-in-from-right duration-500 ${theme === 'dark' ? 'bg-zinc-950/40 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
            <div className="flex items-center gap-2 mb-4">
                <div className={`p-1.5 rounded-lg ${theme === 'dark' ? 'bg-zinc-900' : 'bg-zinc-100'}`}>
                    <Target className="w-4 h-4 text-emerald-500" />
                </div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Puntos Focales Emergentes
                </h3>
            </div>

            <div className="grid grid-cols-1 gap-2">
                {focalPoints.map((fp, i) => (
                    <div
                        key={i}
                        onClick={() => handlePointClick(fp)}
                        className={`group flex items-center justify-between p-2.5 rounded-xl border cursor-pointer active:scale-95 transition-all duration-300 ${theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/50 hover:border-emerald-500/30' : 'bg-zinc-50 border-zinc-200 hover:border-emerald-500/30'}`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded-lg ${fp.type === 'actor' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
                                }`}>
                                {fp.type === 'actor' ? <User className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                            </div>
                            <div>
                                <p className={`text-[11px] font-bold group-hover:text-emerald-400 transition-colors ${theme === 'dark' ? 'text-zinc-200' : 'text-zinc-800'}`}>
                                    {fp.name}
                                </p>
                                <div className="flex items-center gap-2 text-[9px] font-medium text-zinc-500">
                                    <span>{fp.mentions} menciones</span>
                                    {fp.trend === 'emerging' && (
                                        <span className="flex items-center gap-0.5 text-emerald-500">
                                            <TrendingUp className="w-2 h-2" />
                                            Emergente
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="text-right">
                            <div className={`text-[10px] font-black ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-800'}`}>
                                {(fp.score * 100).toFixed(0)}
                            </div>
                            <div className={`w-12 h-1 rounded-full mt-1 overflow-hidden ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                                <div
                                    className="h-full bg-emerald-500"
                                    style={{ width: `${fp.score * 100}%` }}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
