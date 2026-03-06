import React, { useEffect, useState, useCallback } from 'react';
import { Search, Newspaper, Filter, ArrowUpDown, Calendar, Globe, Loader2, ChevronDown, RefreshCw, Target } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { AnalysisDashboard } from '@/components/explorer/AnalysisDashboard';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export const Explorer = () => {
    const { fuente: fuenteParam, titulo: tituloParam } = useParams();
    const [analyses, setAnalyses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [selected, setSelected] = useState<any | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState<any>(null);
    const [showFilters, setShowFilters] = useState(false);

    // Advanced Filters
    const [filters, setFilters] = useState({
        fuente: '',
        startDate: '',
        endDate: '',
        status: '',
    });

    const fetchAnalyses = useCallback(async (isNextPage = false) => {
        if (isNextPage) setLoadingMore(true);
        else setLoading(true);

        const currentPage = isNextPage ? page + 1 : 1;

        const params = new URLSearchParams({
            page: currentPage.toString(),
            limit: '20',
            search: searchTerm,
            fuente: filters.fuente,
            startDate: filters.startDate,
            endDate: filters.endDate,
            status: filters.status,
        });

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
        try {
            const res = await fetch(`${API_URL}/analysis?${params.toString()}`);
            const data = await res.json();
            const results = data.data || [];

            if (isNextPage) {
                setAnalyses(prev => [...prev, ...results]);
                setPage(currentPage);
            } else {
                setAnalyses(results);
                setPage(1);

                // Handle deep-link from URL (Legacy ?id= or SEO slug)
                const urlParams = new URLSearchParams(window.location.search);
                const targetId = urlParams.get('id');
                const targetSlug = fuenteParam && tituloParam ? `${fuenteParam}/${tituloParam}` : null;

                if (targetId || targetSlug) {
                    const identifier = targetId || targetSlug;
                    const found = results.find((r: any) => r.id === identifier || r.slug === identifier);

                    if (found) {
                        setSelected(found);
                    } else {
                        // If not in first page, fetch it specifically
                        try {
                            const singleRes = await fetch(`${API_URL}/analysis/${encodeURIComponent(identifier || '')}`);
                            const singleData = await singleRes.json();
                            if (singleData && !singleData.error) {
                                setSelected(singleData);
                                // Prepend to list so it's visible if it wasn't there
                                setAnalyses(prev => {
                                    if (prev.find(p => p.id === singleData.id)) return prev;
                                    return [singleData, ...prev];
                                });
                            }
                        } catch (e) {
                            if (results.length > 0) setSelected(results[0]);
                        }
                    }
                    // Clean URL param to avoid re-selection on refresh if user clicks elsewhere
                    if (targetId) {
                        window.history.replaceState({}, '', window.location.pathname);
                    }
                } else if (results.length > 0) {
                    setSelected(results[0]);
                }
            }
            setPagination(data.pagination);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [searchTerm, filters, page, fuenteParam, tituloParam]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchAnalyses();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm, filters.fuente, filters.startDate, filters.endDate]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const hasMore = pagination && pagination.page < pagination.totalPages;

    if (loading && analyses.length === 0) {
        return (
            <div className="flex bg-background h-[calc(100vh-100px)] animate-pulse">
                <div className="w-96 border-r p-4 space-y-4">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-24 bg-muted rounded-xl" />
                    ))}
                </div>
                <div className="flex-1 p-8 bg-muted/20" />
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-140px)] gap-0 overflow-hidden -m-6 relative">
            {/* Sidebar List */}
            <div className="w-96 border-r flex flex-col bg-background shrink-0 z-10 shadow-lg">
                <div className="p-4 border-b space-y-4 bg-white dark:bg-slate-950/50 backdrop-blur-md sticky top-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-600 rounded-lg">
                                <Newspaper className="w-4 h-4 text-white" />
                            </div>
                            <h2 className="text-xl font-black tracking-tighter">
                                Explorador
                            </h2>
                        </div>
                        <span className="text-[10px] px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full font-black border border-blue-100 dark:border-blue-900">
                            {pagination?.total || 0} ITEMS
                        </span>
                    </div>

                    <div className="space-y-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Filtrar por titular..."
                                className="pl-9 h-11 bg-muted/50 border-none rounded-xl text-sm focus-visible:ring-2 focus-visible:ring-blue-500 transition-all shadow-inner"
                                value={searchTerm}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={cn(
                                    "flex-1 py-2 px-3 text-[10px] font-bold rounded-xl flex items-center justify-center gap-2 transition-all border",
                                    showFilters
                                        ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/30"
                                        : "bg-white dark:bg-black/20 hover:bg-muted border-slate-200 dark:border-slate-800"
                                )}
                            >
                                <Filter className="w-3 h-3" /> {showFilters ? 'CERRAR FILTROS' : 'FILTROS AVANZADOS'}
                            </button>
                            <button
                                onClick={() => fetchAnalyses()}
                                className="w-11 h-11 bg-white dark:bg-black/20 hover:bg-muted border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center transition-all group"
                            >
                                <RefreshCw className={cn("w-4 h-4 group-active:rotate-180 transition-transform duration-500", loading && "animate-spin")} />
                            </button>
                        </div>
                    </div>

                    {showFilters && (
                        <div className="p-4 bg-muted/30 rounded-2xl border border-dashed space-y-4 animate-in slide-in-from-top duration-300">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-muted-foreground uppercase flex items-center gap-1">
                                    <Globe className="w-3 h-3" /> Medio / Fuente
                                </label>
                                <Input
                                    name="fuente"
                                    placeholder="Ej: El País, Mundo..."
                                    className="h-9 bg-white dark:bg-black/20 border-slate-200 dark:border-slate-800 text-xs rounded-lg"
                                    value={filters.fuente}
                                    onChange={handleFilterChange}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-muted-foreground uppercase flex items-center gap-1">
                                    <Target className="w-3 h-3" /> Estado del Análisis
                                </label>
                                <div className="flex p-1 bg-white dark:bg-black/20 border border-slate-200 dark:border-slate-800 rounded-xl gap-1">
                                    {['', 'COMPLETED', 'FAILED'].map((st) => (
                                        <button
                                            key={st}
                                            onClick={() => setFilters(prev => ({ ...prev, status: st }))}
                                            className={cn(
                                                "flex-1 py-1.5 rounded-lg text-[9px] font-black transition-all",
                                                filters.status === st
                                                    ? (st === 'FAILED' ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" : st === 'COMPLETED' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-blue-600 text-white shadow-lg shadow-blue-500/30")
                                                    : "hover:bg-muted text-muted-foreground"
                                            )}
                                        >
                                            {st === '' ? 'TODOS' : st}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase flex items-center gap-1">
                                        <Calendar className="w-3 h-3" /> Desde
                                    </label>
                                    <Input
                                        type="date"
                                        name="startDate"
                                        className="h-9 bg-white dark:bg-black/20 border-slate-200 dark:border-slate-800 text-[10px] rounded-lg"
                                        value={filters.startDate}
                                        onChange={handleFilterChange}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase flex items-center gap-1">
                                        <Calendar className="w-3 h-3" /> Hasta
                                    </label>
                                    <Input
                                        type="date"
                                        name="endDate"
                                        className="h-9 bg-white dark:bg-black/20 border-slate-200 dark:border-slate-800 text-[10px] rounded-lg"
                                        value={filters.endDate}
                                        onChange={handleFilterChange}
                                    />
                                </div>
                            </div>
                            <button
                                onClick={() => setFilters({ fuente: '', startDate: '', endDate: '', status: '' })}
                                className="w-full py-1.5 text-[9px] font-bold text-rose-500 hover:text-rose-600 transition-colors uppercase tracking-widest"
                            >
                                Limpiar Filtros
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30 dark:bg-transparent">
                    {analyses.length > 0 ? (
                        <>
                            {analyses.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => setSelected(item)}
                                    className={`p-5 cursor-pointer transition-all border-b relative group ${selected?.id === item.id
                                        ? 'bg-blue-50/50 dark:bg-blue-900/10 active-indicator'
                                        : 'hover:bg-white dark:hover:bg-white/5'
                                        }`}
                                >
                                    {selected?.id === item.id && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />
                                    )}
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest truncate max-w-[150px]">{item.fuente}</span>
                                        </div>
                                        <span className="text-[9px] font-mono font-bold text-slate-400">
                                            {new Date(item.fechaExtraccion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <h3 className={`text-sm font-bold leading-snug line-clamp-2 transition-colors ${selected?.id === item.id ? 'text-blue-700 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300 group-hover:text-foreground'}`}>
                                        {item.titular || "Sin título disponible"}
                                    </h3>
                                    <div className="mt-4 flex items-center justify-between">
                                        <div className="flex gap-1">
                                            <ScoreBadge value={item.scoreGlobal} label="G" />
                                            <ScoreBadge value={item.scoreCalidad} label="Q" color="bg-emerald-500" />
                                            <ScoreBadge value={item.scoreDesin} label="D" color="bg-rose-500" />
                                        </div>
                                        <div className={`text-[10px] px-2 py-0.5 rounded-md font-black shadow-sm ${item.status === 'COMPLETED'
                                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                            : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                                            }`}>
                                            {item.status}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {hasMore && (
                                <div className="p-6 text-center">
                                    <button
                                        onClick={() => fetchAnalyses(true)}
                                        disabled={loadingMore}
                                        className="px-6 py-2.5 bg-slate-900 dark:bg-white dark:text-black text-white text-[10px] font-black rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center gap-2 mx-auto shadow-xl"
                                    >
                                        {loadingMore ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <RefreshCw className="w-3 h-3" />
                                        )}
                                        CARGAR MÁS NOTICIAS
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4 opacity-40">
                            <div className="p-6 bg-muted rounded-full">
                                <Search className="w-10 h-10 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">Sin resultados</p>
                                <p className="text-xs text-muted-foreground">Prueba ajustando los filtros de búsqueda</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto bg-[#F8FAFC] dark:bg-[#020617] p-10 custom-scrollbar scroll-smooth">
                {selected ? (
                    <div className="max-w-4xl mx-auto">
                        <AnalysisDashboard analysis={selected} />
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-6 animate-in fade-in zoom-in duration-1000">
                        <div className="relative">
                            <div className="absolute -inset-4 bg-blue-500/10 rounded-full blur-2xl animate-pulse" />
                            <div className="relative p-10 bg-white dark:bg-slate-900 rounded-[3rem] border border-dashed border-blue-200 dark:border-blue-900 shadow-2xl">
                                <Newspaper className="w-20 h-20 text-blue-500/20" />
                            </div>
                        </div>
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">
                                Intelligence News Explorer
                            </h3>
                            <p className="text-sm font-medium text-slate-500 max-w-xs mx-auto">
                                Selecciona un reporte del flujo de noticias para iniciar el desglose de inteligencia y métricas de calidad.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .active-indicator::after {
                    content: '';
                    position: absolute;
                    right: 0;
                    top: 50%;
                    transform: translateY(-50%);
                    border-top: 10px solid transparent;
                    border-bottom: 10px solid transparent;
                    border-right: 10px solid #2563eb;
                    opacity: 0.8;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 5px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #1e293b;
                }
                .custom-scrollbar:hover::-webkit-scrollbar-thumb {
                    background: #3b82f6;
                }
            `}</style>
        </div>
    );
};

const ScoreBadge = ({ value, label, color = "bg-blue-600" }: { value: number, label: string, color?: string }) => {
    if (value === null || value === undefined) return (
        <div className="flex items-center gap-1 bg-white/50 dark:bg-black/20 border rounded-md px-1 py-0.5 opacity-30">
            <span className="text-[8px] font-black">{label}</span>
            <span className="text-[10px] font-black">-</span>
        </div>
    );
    const scoreVal = Math.round(value * 100);
    return (
        <div className="flex items-center gap-1 bg-white dark:bg-black/40 border dark:border-slate-800 rounded-md px-1.5 py-0.5 shadow-sm">
            <span className="text-[8px] font-black opacity-50">{label}</span>
            <div className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_4px_rgba(0,0,0,0.2)]", color)}></div>
            <span className="text-[10px] font-black">{scoreVal}</span>
        </div>
    );
}

