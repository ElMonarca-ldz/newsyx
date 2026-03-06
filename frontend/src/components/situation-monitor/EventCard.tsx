import { MapPin, Calendar, ExternalLink, AlertTriangle, Boxes, Share2, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useSituationMonitorStore } from '@/stores/situationMonitorStore';
import type { SituationEvent } from '@/types/situation-monitor';

interface Props {
    evento: SituationEvent;
    isSelected: boolean;
    isGeoHighlighted: boolean;
    onSelect: () => void;
}

const certezaBadge: Record<string, string> = {
    confirmado: 'bg-green-900/50 text-green-400 border-green-800',
    inferido: 'bg-amber-900/50 text-amber-400 border-amber-800',
    especulativo: 'bg-indigo-900/50 text-indigo-400 border-indigo-800',
};

const tipoLabel: Record<string, string> = {
    antecedente_lejano: 'Antecedente',
    antecedente_inmediato: 'Antecedente reciente',
    evento_central: 'Evento central',
    consecuencia_directa: 'Consecuencia',
    proyeccion: 'Proyección',
};

const categoryBadge: Record<string, string> = {
    politica_nacional: 'bg-red-900/30 text-red-400 border-red-800/50',
    economia: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50',
    policiales: 'bg-orange-900/30 text-orange-400 border-orange-800/50',
    deportes: 'bg-sky-900/30 text-sky-400 border-sky-800/50',
    espectaculos: 'bg-pink-900/30 text-pink-400 border-pink-800/50',
    ciencia_tecnologia: 'bg-violet-900/30 text-violet-400 border-violet-800/50',
    sociedad: 'bg-amber-900/30 text-amber-400 border-amber-800/50',
    internacional: 'bg-blue-900/30 text-blue-400 border-blue-800/50',
    negocios: 'bg-teal-900/30 text-teal-400 border-teal-800/50',
    salud: 'bg-rose-900/30 text-rose-400 border-rose-800/50',
    turismo: 'bg-lime-900/30 text-lime-400 border-lime-800/50',
    otro: 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50'
};

export function EventCard({ evento, isSelected, isGeoHighlighted, onSelect }: Props) {
    const { hoverGeo, setHighlightedQuote, selectArticleForExplorer, setShareEventData, setShareModalOpen } = useSituationMonitorStore();
    const [copied, setCopied] = useState(false);

    const handleShare = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShareEventData(evento);
        setShareModalOpen(true);
    };

    const fecha = evento.fecha_exacta
        ? new Date(evento.fecha_exacta).toLocaleDateString('es', { dateStyle: 'medium' })
        : evento.fecha_aproximada
            ? `~ ${evento.fecha_aproximada}`
            : 'Fecha no determinada';

    return (
        <div
            onClick={onSelect}
            onMouseEnter={() => hoverGeo(evento.lugar?.slug ?? null)}
            onMouseLeave={() => hoverGeo(null)}
            className={`
                relative rounded-lg border p-3 mb-1.5 cursor-pointer
                transition-all duration-150 select-none
                ${isSelected
                    ? 'border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/20 shadow-md shadow-emerald-500/10'
                    : isGeoHighlighted
                        ? 'border-zinc-300 dark:border-zinc-500 bg-zinc-100 dark:bg-zinc-800/60'
                        : 'border-zinc-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/30'
                }
            `}
        >
            {/* Header */}
            <div className="flex items-start gap-2 mb-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded-md border font-medium ${certezaBadge[evento.certeza_evento] || certezaBadge.especulativo}`}>
                            {evento.certeza_evento}
                        </span>
                        {evento.articulo.categoria && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-md border font-medium uppercase tracking-tight ${categoryBadge[evento.articulo.categoria] || categoryBadge.otro}`}>
                                {evento.articulo.categoria.replace('_', ' ')}
                            </span>
                        )}
                        <span className="text-xs text-zinc-500">
                            {tipoLabel[evento.tipo_temporal] || evento.tipo_temporal}
                        </span>
                        {evento.es_hecho_central && (
                            <span className="text-xs px-1 py-0.5 rounded bg-red-900/30 text-red-400 border border-red-800/50">
                                ★ Central
                            </span>
                        )}
                        {evento.es_convergente && (
                            <span
                                className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-bold italic"
                                title="Confirmado por múltiples medios"
                            >
                                <Boxes className="w-2.5 h-2.5" />
                                CONVERGENCIA
                            </span>
                        )}
                        {(() => {
                            const now = new Date();
                            const pubDate = new Date(evento.articulo.fecha_publicacion);
                            const diffHours = (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60);
                            if (diffHours < 24) {
                                return (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500 text-white font-black animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                                        JUST IN
                                    </span>
                                );
                            }
                            return null;
                        })()}
                    </div>
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-zinc-900 dark:text-zinc-100 font-medium leading-snug line-clamp-2">
                            {evento.descripcion}
                        </p>
                        <button
                            onClick={handleShare}
                            title="Copiar sub-evento al portapapeles"
                            className="flex-shrink-0 p-1.5 rounded-md hover:bg-zinc-700/50 text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {evento.articulo.scoreDesin > 0.6 && (
                    <div className="flex-shrink-0 mt-0.5" title={`Riesgo desinformación: ${(evento.articulo.scoreDesin * 100).toFixed(0)}%`}>
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                    </div>
                )}

                {evento.articulo.imagen && (
                    <div className="flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border border-zinc-800 shadow-sm bg-zinc-950">
                        <img
                            src={evento.articulo.imagen}
                            alt=""
                            className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                    </div>
                )}
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-3 text-xs text-zinc-400 mb-2">
                <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{fecha}</span>
                    {evento.confianza_fecha < 0.7 && (
                        <span className="text-zinc-600 ml-0.5" title={`Confianza: ${(evento.confianza_fecha * 100).toFixed(0)}%`}>(?)</span>
                    )}
                </div>
                {evento.lugar && (
                    <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span className="max-w-24 truncate">{evento.lugar.nombre_display}</span>
                    </div>
                )}
                <span className="ml-auto truncate max-w-24 text-zinc-500">
                    {evento.articulo.medio}
                </span>
            </div>

            {/* Tags */}
            {evento.tags_tematicos.length > 0 && (
                <div className="flex gap-1 flex-wrap mb-2">
                    {evento.tags_tematicos.slice(0, 4).map((tag: string) => (
                        <span
                            key={tag}
                            className="text-xs px-1.5 py-0.5 rounded-full bg-zinc-800/60 text-zinc-400 border border-zinc-700/50"
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            )}

            {/* Actors */}
            {evento.actores_resueltos.length > 0 && (
                <div className="flex gap-1 flex-wrap mb-1">
                    {evento.actores_resueltos.slice(0, 3).map((actor: any) => (
                        <span
                            key={actor.slug}
                            className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/40"
                            title={`${actor.tipo} · ${actor.sentimiento_hacia}`}
                        >
                            {actor.label}
                        </span>
                    ))}
                </div>
            )}

            {/* Evidence (on selection) */}
            {isSelected && (
                <div className="mt-2 p-2.5 bg-zinc-50 dark:bg-zinc-800/30 rounded-lg border border-zinc-200 dark:border-zinc-700/40 text-xs text-zinc-600 dark:text-zinc-300 italic">
                    "{evento.fragmento_evidencia}"
                    <button
                        className="inline-flex items-center gap-1 ml-2 text-emerald-600 dark:text-emerald-400 not-italic font-bold hover:underline"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (evento.fragmento_evidencia) {
                                setHighlightedQuote(evento.fragmento_evidencia);
                            }
                            selectArticleForExplorer(evento.articulo.id);
                        }}
                    >
                        Ver artículo <ExternalLink className="w-3 h-3" />
                    </button>
                </div>
            )}
        </div>
    );
}
