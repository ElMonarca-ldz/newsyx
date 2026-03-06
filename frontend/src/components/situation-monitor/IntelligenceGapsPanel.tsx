import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSituationMonitorStore } from '@/stores/situationMonitorStore';
import { EyeOff, AlertTriangle, Info } from 'lucide-react';

interface Gap {
    type: string;
    severity: 'info' | 'warning' | 'danger';
    message: string;
    detected_at: string;
}

export const IntelligenceGapsPanel: React.FC = () => {
    const { theme } = useSituationMonitorStore();
    const { data: gaps, isLoading } = useQuery<Gap[]>({
        queryKey: ['intelligence-gaps'],
        queryFn: () => fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/intelligence/gaps?country=AR`).then(res => res.json()),
        refetchInterval: 300000, // Cada 5 minutos
    });

    if (isLoading || !gaps || gaps.length === 0) return null;

    return (
        <div className={`border rounded-2xl p-4 backdrop-blur-md animate-in fade-in slide-in-from-bottom duration-500 ${theme === 'dark' ? 'bg-zinc-950/40 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${theme === 'dark' ? 'bg-zinc-900' : 'bg-zinc-100'}`}>
                        <EyeOff className="w-4 h-4 text-zinc-400" />
                    </div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Puntos Ciegos Detectados
                    </h3>
                </div>
                <span className="px-2 py-0.5 bg-rose-500/10 text-rose-500 text-[8px] font-black rounded-full uppercase border border-rose-500/20">
                    {gaps.length} Alertas
                </span>
            </div>

            <div className="space-y-2">
                {gaps.map((gap, i) => (
                    <div
                        key={i}
                        className={`group relative flex items-start gap-3 p-3 rounded-xl border transition-all duration-300 ${gap.severity === 'danger'
                            ? 'bg-rose-500/5 border-rose-500/20 hover:border-rose-500/40'
                            : 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40'
                            }`}
                    >
                        <div className={`mt-0.5 p-1 rounded-md ${gap.severity === 'danger' ? 'bg-rose-500/20 text-rose-500' : 'bg-amber-500/20 text-amber-500'
                            }`}>
                            {gap.severity === 'danger' ? (
                                <AlertTriangle className="w-3 h-3" />
                            ) : (
                                <Info className="w-3 h-3" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className={`text-[11px] font-bold leading-tight group-hover:text-emerald-500 transition-colors ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-800'}`}>
                                {gap.message}
                            </p>
                            <span className="text-[9px] font-medium text-zinc-600">
                                {new Date(gap.detected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 pt-4 border-t border-zinc-800/50">
                <p className="text-[9px] font-medium text-zinc-600 text-center italic">
                    El sistema detecta automáticamente baches de información comparando con el volumen histórico de cada fuente.
                </p>
            </div>
        </div>
    );
};
