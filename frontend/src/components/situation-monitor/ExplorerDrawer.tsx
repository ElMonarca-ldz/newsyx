import React from 'react';
import { X, ChevronLeft } from 'lucide-react';
import { useSituationMonitorStore } from '@/stores/situationMonitorStore';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { AnalysisDashboard } from '../explorer/AnalysisDashboard';

export function ExplorerDrawer() {
    const { explorerArticleId, selectArticleForExplorer } = useSituationMonitorStore();

    const { data: analysis, isLoading, error } = useQuery({
        queryKey: ['analysis', explorerArticleId],
        queryFn: async () => {
            if (!explorerArticleId) return null;
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/analysis/${explorerArticleId}`);
            return response.data;
        },
        enabled: !!explorerArticleId,
    });

    if (!explorerArticleId) return null;

    const loading = isLoading;

    return (
        <div className="flex flex-col h-full w-full bg-slate-50 dark:bg-zinc-950 overflow-hidden border-l border-zinc-200 dark:border-zinc-800 animate-in slide-in-from-right duration-500 relative">
            {/* Simple Close Button - Floating */}
            <button
                onClick={() => selectArticleForExplorer(null)}
                className="absolute top-4 right-4 z-50 p-2.5 bg-white/80 dark:bg-zinc-900/80 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-full transition-all text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white backdrop-blur-md shadow-xl"
                title="Cerrar análisis"
            >
                <X className="w-5 h-5" />
            </button>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-zinc-950/20">
                {loading && (
                    <div className="flex flex-col items-center justify-center h-full py-20 gap-4">
                        <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-zinc-500 text-sm font-medium animate-pulse">PROCESANDO ANÁLISIS...</p>
                    </div>
                )}

                {error && (
                    <div className="p-8 text-center bg-red-900/10 border border-red-500/20 rounded-2xl mx-6 my-10">
                        <p className="text-red-400 text-sm font-medium">No se pudieron cargar los datos del análisis.</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-all"
                        >
                            Reintentar
                        </button>
                    </div>
                )}

                {analysis && !loading && (
                    <div className="w-full">
                        <AnalysisDashboard analysis={analysis} />
                    </div>
                )}
            </div>
        </div>
    );
}
