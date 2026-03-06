import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSituationMonitorStore } from '@/stores/situationMonitorStore';
import { fetchSituationMonitor } from '@/api/situationMonitor';
import { FilterBar } from '@/components/situation-monitor/FilterBar';
import { StatsWidgetRow } from '@/components/situation-monitor/StatsWidgetRow';
import { MapPanel } from '@/components/situation-monitor/MapPanel';
import { EventFeed } from '@/components/situation-monitor/EventFeed';
import { SidePanel } from '@/components/situation-monitor/SidePanel';
import { LiveIndicator } from '@/components/situation-monitor/LiveIndicator';
import { ITLWidget } from '@/components/situation-monitor/ITLWidget';
import { IntelligenceGapsPanel } from '@/components/situation-monitor/IntelligenceGapsPanel';
import { ShareStoryModal } from '@/components/situation-monitor/ShareStoryModal';
import { ExplorerDrawer } from '@/components/situation-monitor/ExplorerDrawer';
import { Radar } from 'lucide-react';
import { config } from '@/config/variants';
import { useLiveAlerts } from '@/hooks/useLiveAlerts';

export default function SituationMonitor() {
    // Enable live connection
    useLiveAlerts();

    const {
        filters, setData, splitPosition, setSplitPosition,
        isSidePanelOpen, isShareModalOpen, setShareModalOpen,
        explorerArticleId, feedWidth, setFeedWidth,
        sidePanelWidth, setSidePanelWidth,
        theme, setTheme
    } = useSituationMonitorStore();

    // Fetch data
    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['situation-monitor', filters],
        queryFn: () => fetchSituationMonitor(filters),
        staleTime: 60_000,
        refetchInterval: 120_000,
        retry: 1,
    });

    useEffect(() => {
        if (data) setData(data);
    }, [data, setData]);

    // Splitter drag logic
    const draggingRef = useRef<'split' | 'feed' | 'side' | null>(null);

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!draggingRef.current) return;
            const container = document.getElementById('sm-panels');
            if (!container) return;
            const rect = container.getBoundingClientRect();

            if (draggingRef.current === 'split') {
                const pct = Math.min(80, Math.max(20, ((e.clientX - rect.left) / rect.width) * 100));
                setSplitPosition(pct);
            } else if (draggingRef.current === 'feed') {
                const mapWidth = (rect.width * splitPosition) / 100;
                const newWidth = Math.max(300, Math.min(600, e.clientX - rect.left - mapWidth));
                setFeedWidth(newWidth);
            } else if (draggingRef.current === 'side' && isSidePanelOpen) {
                const rightX = rect.right;
                const newWidth = Math.max(300, Math.min(800, rightX - e.clientX));
                setSidePanelWidth(newWidth);
            }
        };

        const onMouseUp = () => { draggingRef.current = null; };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [splitPosition, setSplitPosition, setFeedWidth, setSidePanelWidth, isSidePanelOpen]);

    // Layout calculation based on state
    const getLayoutWeights = () => {
        if (explorerArticleId) {
            return { map: '25%', feed: '25%', detail: '50%' };
        }
        if (isSidePanelOpen) {
            return { map: '33.33%', feed: '33.33%', detail: '33.33%' };
        }
        return { map: '50%', feed: '50%', detail: '0%' };
    };

    const weights = getLayoutWeights();

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    return (
        <div className={`flex flex-col h-screen w-screen overflow-hidden relative font-sans ${theme === 'dark' ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'}`}>

            {/* Topbar */}
            <div className="flex-none flex items-center gap-3 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm relative z-[1100]">
                <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <Radar className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-sm font-bold tracking-tight uppercase hidden sm:block">
                            Newsyx
                        </span>
                        <LiveIndicator />
                    </div>
                </div>

                <div className="flex items-center overflow-x-auto min-w-0 hide-scrollbar gap-2 pl-4 border-l border-zinc-800 h-8 flex-1">
                    <ITLWidget />
                    <div className="w-px h-full bg-zinc-800 mx-2" />
                    <StatsWidgetRow />
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <button
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className={`p-2 rounded-xl border transition-all ${theme === 'dark'
                            ? 'bg-zinc-800 border-zinc-700 text-amber-400 hover:bg-zinc-700'
                            : 'bg-white border-zinc-200 text-indigo-600 hover:bg-zinc-50 shadow-sm'
                            }`}
                        title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                    >
                        {theme === 'dark' ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 18v1m9-9h1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.364l-.707-.707M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                        )}
                    </button>
                    <FilterBar />
                </div>
            </div>

            {/* Panels Container */}
            <div className={`flex-1 flex flex-row min-h-0 relative overflow-hidden ${theme === 'dark' ? 'bg-zinc-950' : 'bg-zinc-50'}`} id="sm-panels">

                {/* 1. Map Column */}
                <div
                    style={{ width: weights.map }}
                    className="relative overflow-hidden shrink-0 h-full border-r border-zinc-200 dark:border-zinc-800/50 transition-all duration-700 ease-in-out"
                >
                    <MapPanel />
                    {explorerArticleId && config.features.itlScore && (
                        <div className="absolute bottom-4 left-4 z-20 pointer-events-none">
                            <div className="pointer-events-auto max-w-sm">
                                <IntelligenceGapsPanel />
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. Feed Column */}
                <div
                    style={{ width: weights.feed }}
                    className={`h-full border-r border-zinc-200 dark:border-zinc-800/50 relative overflow-hidden transition-all duration-700 ease-in-out ${theme === 'dark' ? 'bg-zinc-950' : 'bg-white'}`}
                >
                    <EventFeed />
                    {!explorerArticleId && config.features.itlScore && (
                        <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none">
                            <div className="pointer-events-auto">
                                <IntelligenceGapsPanel />
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. Detail / Explorer Column */}
                <div
                    style={{ width: weights.detail }}
                    className={`h-full bg-zinc-900 flex flex-col overflow-hidden transition-all duration-700 ease-in-out border-l border-zinc-800/50 ${!weights.detail || weights.detail === '0%' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                >
                    {explorerArticleId ? <ExplorerDrawer /> : <SidePanel />}
                </div>
            </div>

            {/* Overlays */}
            {isLoading && !data && (
                <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center z-[10000]">
                    <div className="flex flex-col items-center gap-3 animate-pulse">
                        <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-zinc-400 font-medium tracking-tight">SINCRONIZANDO MONITOR...</span>
                    </div>
                </div>
            )}

            {isError && !data && (
                <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center z-[10000]">
                    <div className="flex flex-col items-center gap-4 text-center max-w-md p-8 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl">
                        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                            <Radar className="w-8 h-8 text-red-500" />
                        </div>
                        <h2 className="text-xl font-bold text-zinc-100">Error de conexión</h2>
                        <p className="text-sm text-zinc-400 leading-relaxed"> No se pudo establecer comunicación con el centro de datos. Reintenta en unos instantes.</p>
                        <button onClick={() => window.location.reload()} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all shadow-lg shadow-emerald-500/20">Reintentar</button>
                    </div>
                </div>
            )}

            <ShareStoryModal isOpen={isShareModalOpen} onClose={() => setShareModalOpen(false)} />
        </div>
    );
}
