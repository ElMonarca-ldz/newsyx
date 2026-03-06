import { useSituationMonitorStore } from '@/stores/situationMonitorStore';
import { Search, SlidersHorizontal, X, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { TimelineScrubber } from './TimelineScrubber';
import { CustomDateRangePicker } from './CustomDateRangePicker';

export function FilterBar() {
    const { filters, setFilters, resetFilters, data, theme } = useSituationMonitorStore();
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Extract unique tags, actors, and places from data
    const allTags: string[] = Array.from(new Set((data?.eventos || []).flatMap((e: any) => (e.tags_tematicos || []) as string[]))).slice(0, 20);
    const allActors: string[] = Array.from(new Set((data?.eventos || []).flatMap((e: any) => ((e.actores_resueltos || []) as any[]).map((a: any) => a.label as string)))).slice(0, 20);
    const allPlaces: { slug: string; label: string }[] = [...new Set(
        (data?.eventos || [])
            .filter((e: any) => e.lugar)
            .map((e: any) => ({ slug: e.lugar!.slug, label: e.lugar!.nombre_display }))
            .map((p: { slug: string; label: string }) => JSON.stringify(p))
    )].map((s) => JSON.parse(s as string)).slice(0, 20);
    const allCategorias: string[] = Array.from(new Set((data?.eventos || [])
        .map((e: any) => e.articulo?.categoria)
        .filter(Boolean) as string[])).slice(0, 15);

    return (
        <div className="flex items-center gap-2">
            {/* Unified Date Range Picker */}
            <CustomDateRangePicker
                startDate={filters.fechaDesde}
                endDate={filters.fechaHasta}
                onChange={(start, end) => setFilters({ fechaDesde: start, fechaHasta: end })}
            />


            {/* Certeza filter chips */}
            <div className="flex items-center gap-0.5">
                {(['confirmado', 'inferido', 'especulativo'] as const).map(c => {
                    const active = filters.certeza.includes(c);
                    return (
                        <button
                            key={c}
                            onClick={() => setFilters({
                                certeza: active
                                    ? filters.certeza.filter((x: string) => x !== c)
                                    : [...filters.certeza, c]
                            })}
                            className={`text-[10px] px-2 py-0.5 rounded-full transition-all border uppercase font-black tracking-tight ${active
                                ? c === 'confirmado' ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                    : c === 'inferido' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                        : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                                : `${theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-zinc-500' : 'bg-white border-zinc-200 text-zinc-400'}`
                                }`}
                        >
                            {c}
                        </button>
                    );
                })}
            </div>

            {/* Solo hechos centrales */}
            <button
                onClick={() => setFilters({ soloHechosCentrales: !filters.soloHechosCentrales })}
                className={`text-[10px] px-2 py-0.5 rounded-md border font-black uppercase tracking-tight transition-all ${filters.soloHechosCentrales
                    ? 'bg-red-500/20 text-red-400 border-red-500/30'
                    : `${theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-zinc-500' : 'bg-white border-zinc-200 text-zinc-400'}`
                    }`}
            >
                ★ Centrales
            </button>

            {/* Advanced toggle */}
            <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`text-[10px] uppercase font-black tracking-widest transition-colors flex items-center gap-1.5 ml-1 ${theme === 'dark' ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
                <SlidersHorizontal className="w-3 h-3" />
                Avanzado
            </button>

            {/* Reset */}
            <button
                onClick={resetFilters}
                className={`p-1.5 rounded-lg border transition-all ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300' : 'bg-white border-zinc-200 text-zinc-400 hover:text-zinc-600'}`}
                title="Resetear filtros"
            >
                <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Advanced popover */}
            {showAdvanced && (
                <div className={`absolute top-12 left-0 right-0 mx-auto w-96 border rounded-2xl p-4 z-40 shadow-2xl transition-colors ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                    <div className="flex items-center justify-between mb-4">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>Filtros avanzados</span>
                        <button onClick={() => setShowAdvanced(false)} className="text-zinc-500 hover:text-rose-500 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Timeline Scrubber */}
                    <div className="mb-4 bg-zinc-950/50 rounded-lg p-2 border border-zinc-800/50">
                        <div className="text-xs text-zinc-400 mb-2 px-1 font-medium">Línea de tiempo</div>
                        <TimelineScrubber />
                    </div>

                    {/* Score Desinformación */}
                    <div className="mb-3">
                        <label className="text-xs text-zinc-400 mb-1 block">Máx. score desinformación</label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={filters.scoreDesinMax}
                            onChange={(e) => setFilters({ scoreDesinMax: parseFloat(e.target.value) })}
                            className="w-full accent-emerald-500"
                        />
                        <span className="text-xs text-zinc-500">{(filters.scoreDesinMax * 100).toFixed(0)}%</span>
                    </div>

                    {/* Tag filter - scrollable chips */}
                    {allTags.length > 0 && (
                        <div className="mb-3">
                            <label className="text-xs text-zinc-400 mb-1 block">Temas</label>
                            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                                {allTags.map((tag: string) => {
                                    const active = filters.tagsTematicos.includes(tag);
                                    return (
                                        <button
                                            key={tag}
                                            onClick={() => setFilters({
                                                tagsTematicos: active
                                                    ? filters.tagsTematicos.filter((t: string) => t !== tag)
                                                    : [...filters.tagsTematicos, tag]
                                            })}
                                            className={`text-xs px-1.5 py-0.5 rounded-full ${active
                                                ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-700/50'
                                                : 'bg-zinc-800 text-zinc-400 border border-zinc-700/50'
                                                }`}
                                        >
                                            {tag}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Categoria filter - scrollable chips */}
                    {allCategorias.length > 0 && (
                        <div className="mb-3">
                            <label className="text-xs text-zinc-400 mb-1 block">Categorías</label>
                            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                                {allCategorias.map((cat: string) => {
                                    const active = filters.categorias.includes(cat);
                                    return (
                                        <button
                                            key={cat}
                                            onClick={() => setFilters({
                                                categorias: active
                                                    ? filters.categorias.filter((c: string) => c !== cat)
                                                    : [...filters.categorias, cat]
                                            })}
                                            className={`text-xs px-1.5 py-0.5 rounded-full uppercase tracking-tight ${active
                                                ? 'bg-purple-900/40 text-purple-400 border border-purple-700/50'
                                                : 'bg-zinc-800 text-zinc-400 border border-zinc-700/50'
                                                }`}
                                        >
                                            {cat.replace('_', ' ')}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Place filter */}
                    {allPlaces.length > 0 && (
                        <div className="mb-3">
                            <label className="text-xs text-zinc-400 mb-1 block">Lugares</label>
                            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                                {allPlaces.map((p: { slug: string; label: string }) => {
                                    const active = filters.lugaresIds.includes(p.slug);
                                    return (
                                        <button
                                            key={p.slug}
                                            onClick={() => setFilters({
                                                lugaresIds: active
                                                    ? filters.lugaresIds.filter((l: string) => l !== p.slug)
                                                    : [...filters.lugaresIds, p.slug]
                                            })}
                                            className={`text-xs px-1.5 py-0.5 rounded-full ${active
                                                ? 'bg-blue-900/40 text-blue-400 border border-blue-700/50'
                                                : 'bg-zinc-800 text-zinc-400 border border-zinc-700/50'
                                                }`}
                                        >
                                            {p.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
