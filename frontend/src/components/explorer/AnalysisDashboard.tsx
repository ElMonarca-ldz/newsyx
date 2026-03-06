import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import {
    AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, ExternalLink,
    Info, MessageSquare, Newspaper, ShieldAlert, Target, TrendingUp, Users,
    UserPlus, UserMinus, Clock, BookOpen, Brain, Zap, Eye, HelpCircle,
    CircleDot, ArrowRight, Activity, Gauge, Trash2, Loader2, Share2,
    Calendar, Globe, Network, MapPin, Search, ChevronRight, Hash, Quote,
    Printer, Download, Bookmark, Flag, Volume2, CalendarClock, ChevronLeft
} from 'lucide-react';
import { useSituationMonitorStore } from '@/stores/situationMonitorStore';
import { ActorTimelinePanel } from '@/components/situation-monitor/ActorTimelinePanel';
import { ShareStoryModal } from '../situation-monitor/ShareStoryModal';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AnalysisDashboardProps {
    analysis: any;
}

// ===== CONSTANTS & HELPERS =====
const rhetoricalLabels: Record<string, string> = {
    hecho_verificable: '✓ Hecho',
    opinion_autor: '💭 Opinión',
    cita_directa: '💬 Cita',
    metafora_activa: '🎭 Metáfora',
    apelacion_emocional: '❤️ Emocional',
    contexto_historico: '📚 Contexto',
    dato_sin_fuente: '⚠️ Sin fuente',
    llamada_accion: '📢 Llamada',
    ironia_sarcasmo: '😏 Ironía',
};


const EnrichedArticleBody: React.FC<{
    body: string;
    segments: any[];
    activeSegmentId: number | null;
    onSegmentHover: (id: number | null) => void;
}> = ({ body, segments, activeSegmentId, onSegmentHover }) => {
    const { highlightedQuote } = useSituationMonitorStore();

    if (!body) {
        return <p className="italic opacity-50 text-center py-10">No se pudo recuperar el cuerpo original de la noticia.</p>;
    }

    // Process the body to highlight the exact quote if it exists
    let displayBody = body;
    if (highlightedQuote && body.includes(highlightedQuote)) {
        displayBody = body.replace(highlightedQuote, `\`HT_QUOTE:${highlightedQuote}\``);
    }

    // Markdown rendering with custom components for the premium look
    return (
        <div className="prose prose-zinc dark:prose-invert max-w-none 
            prose-headings:font-black prose-headings:tracking-tight prose-headings:italic prose-headings:uppercase prose-headings:text-zinc-100
            prose-p:leading-relaxed prose-p:text-zinc-400
            prose-blockquote:border-l-4 prose-blockquote:border-emerald-500 prose-blockquote:bg-emerald-950/10 prose-blockquote:py-2 prose-blockquote:px-6 prose-blockquote:rounded-r-xl prose-blockquote:italic
            prose-strong:text-white prose-strong:font-black
            prose-a:text-emerald-500
        ">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    code: ({ node, className, children, ...props }: any) => {
                        const str = String(children);
                        if (str.startsWith('HT_QUOTE:')) {
                            return <mark className="bg-yellow-400/80 text-yellow-900 dark:bg-yellow-500/40 dark:text-yellow-100 rounded px-1.5 py-0.5 font-bold shadow-sm transition-colors">{str.replace('HT_QUOTE:', '')}</mark>;
                        }
                        return <code className={className} {...props}>{children}</code>;
                    }
                }}
            >
                {displayBody}
            </ReactMarkdown>
        </div>
    );
};

// ===== READING EXPERIENCE PANEL =====
const ReadingExperiencePanel: React.FC<{ data: any }> = ({ data }) => {
    const re = data?.ui_enrichment?.reading_experience;
    if (!re) return null;

    const complexityColors: Record<string, string> = {
        accesible: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
        estandar: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
        tecnico: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
        especializado: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
    };

    const readerLabels: Record<string, string> = {
        ciudadano_general: '👤 Ciudadano General',
        analista_politico: '🎯 Analista Político',
        periodista: '📰 Periodista',
        investigador_academico: '🎓 Investigador',
        decision_maker: '💼 Decision Maker',
    };

    return (
        <Card className="border-none bg-gradient-to-r from-zinc-900 to-zinc-800 shadow-lg overflow-hidden border border-zinc-800/50">
            <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                    <BookOpen className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Experiencia de Lectura</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-zinc-500" />
                        <div>
                            <p className="text-lg font-black">{re.tiempo_lectura_minutos} min</p>
                            <p className="text-[10px] text-zinc-500">Tiempo lectura</p>
                        </div>
                    </div>
                    <div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${complexityColors[re.nivel_complejidad] || complexityColors.estandar}`}>
                            {re.nivel_complejidad}
                        </span>
                        <p className="text-[10px] text-muted-foreground mt-1">Complejidad</p>
                    </div>
                    <div>
                        <div className="flex items-center gap-1">
                            <Activity className="w-3 h-3 text-blue-500" />
                            <span className="text-lg font-black">{(re.densidad_informativa * 100).toFixed(0)}%</span>
                        </div>
                        <p className="text-[10px] text-zinc-500">Densidad info.</p>
                    </div>
                    <div>
                        <span className="text-sm font-medium">{readerLabels[re.lectura_recomendada_para] || re.lectura_recomendada_para}</span>
                        <p className="text-[10px] text-zinc-500">Perfil lector</p>
                    </div>
                </div>

                {re.fragmento_gancho && (
                    <div className="p-3 bg-zinc-950/40 rounded-xl border border-blue-500/20 mb-3">
                        <div className="flex items-center gap-1 mb-1">
                            <Zap className="w-3 h-3 text-amber-500" />
                            <span className="text-[10px] font-bold text-amber-600 uppercase">Gancho</span>
                        </div>
                        <p className="text-sm font-medium italic text-slate-700 dark:text-slate-300">"{re.fragmento_gancho}"</p>
                    </div>
                )}

                {re.pregunta_critica_no_respondida && (
                    <div className="p-3 bg-rose-950/10 rounded-xl border border-rose-500/20">
                        <div className="flex items-center gap-1 mb-1">
                            <HelpCircle className="w-3 h-3 text-rose-500" />
                            <span className="text-[10px] font-bold text-rose-600 uppercase">Pregunta sin responder</span>
                        </div>
                        <p className="text-sm font-semibold text-rose-400">{re.pregunta_critica_no_respondida}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

// ===== RHETORICAL HEATMAP =====
const RhetoricalHeatmap: React.FC<{
    data: any;
    activeSegmentId: number | null;
    onSegmentHover: (id: number | null) => void;
}> = ({ data, activeSegmentId, onSegmentHover }) => {
    const heatmap = data?.ui_enrichment?.rhetorical_heatmap;
    if (!heatmap?.segmentos?.length) return null;

    return (
        <Card className="shadow-lg border-none bg-card/50 backdrop-blur">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Eye className="w-4 h-4 text-purple-500" />
                    Mapa de Calor Retórico
                    <span className="text-[10px] font-normal text-muted-foreground ml-2">
                        Intensidad media: {(heatmap.intensidad_media * 100).toFixed(0)}%
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {/* Legend */}
                <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b">
                    {Object.entries(rhetoricalLabels).map(([key, label]) => {
                        const seg = heatmap.segmentos.find((s: any) => s.tipo === key);
                        if (!seg) return null;
                        return (
                            <span
                                key={key}
                                className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                                style={{ backgroundColor: seg.color_hint, color: '#333' }}
                            >
                                {label}
                            </span>
                        );
                    })}
                </div>

                {/* Segments */}
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {heatmap.segmentos.map((seg: any) => (
                        <div
                            key={seg.id}
                            onMouseEnter={() => onSegmentHover(seg.id)}
                            onMouseLeave={() => onSegmentHover(null)}
                            className={cn(
                                "p-3 rounded-xl border transition-all hover:shadow-md cursor-default",
                                (seg.id === heatmap.segmento_pico || seg.id === activeSegmentId) ? 'ring-2 ring-purple-500 shadow-md' : '',
                                activeSegmentId === seg.id ? 'scale-[1.02] bg-opacity-60' : ''
                            )}
                            style={{ backgroundColor: seg.color_hint + '40', borderColor: seg.color_hint }}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[9px] font-bold uppercase" style={{ color: seg.color_hint.replace('#E', '#8').replace('#F', '#9') }}>
                                    {rhetoricalLabels[seg.tipo] || seg.tipo}
                                </span>
                                <div className="flex items-center gap-2">
                                    {seg.id === heatmap.segmento_pico && (
                                        <span className="text-[8px] px-1.5 py-0.5 bg-purple-500 text-white rounded-full font-bold">PICO</span>
                                    )}
                                    <span className="text-[10px] font-mono text-zinc-500">
                                        {(seg.intensidad * 100).toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                <span className="font-medium">{seg.texto_inicio}</span>
                                <span className="mx-1 opacity-40">…</span>
                                <span className="font-medium">{seg.texto_fin}</span>
                            </p>
                            {/* Intensity bar */}
                            <div className="mt-2 h-1 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all"
                                    style={{ width: `${seg.intensidad * 100}%`, backgroundColor: seg.color_hint.replace('#E', '#6').replace('#F', '#7') }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

// ===== ACTOR NETWORK =====
const ActorNetworkGraph: React.FC<{ data: any }> = ({ data }) => {
    const { selectActor } = useSituationMonitorStore();
    const network = data?.ui_enrichment?.actor_network;
    if (!network?.nodos?.length) return null;

    const tipoColors: Record<string, string> = {
        gobierno: '#C0392B',
        oposicion: '#2980B9',
        experto: '#27AE60',
        ciudadano: '#F39C12',
        empresa: '#8E44AD',
        ong: '#16A085',
        internacional: '#1A252F',
        medio: '#7F8C8D',
        otro: '#95A5A6',
    };

    const rolIcons: Record<string, string> = {
        protagonista: '⭐',
        antagonista: '🎯',
        neutral: '◎',
        victima: '🛡️',
    };

    const relationColors: Record<string, string> = {
        alianza: '#27AE60',
        oposicion: '#E74C3C',
        critica_a: '#E67E22',
        apoyo_a: '#2ECC71',
        neutralidad: '#95A5A6',
        dependencia: '#9B59B6',
        confrontacion: '#C0392B',
    };

    return (
        <Card className="shadow-lg border-none bg-card/50 backdrop-blur">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-500" />
                    Red de Actores
                </CardTitle>
            </CardHeader>
            <CardContent>
                {/* Nodes */}
                <div className="flex flex-wrap gap-3 mb-4">
                    {network.nodos.map((nodo: any) => (
                        <div
                            key={nodo.id}
                            onClick={() => selectActor(nodo.id)}
                            className="relative group flex items-center gap-2 px-3 py-2 rounded-2xl border-2 shadow-sm hover:shadow-lg transition-all cursor-pointer hover:scale-105 active:scale-95 bg-white/5 dark:bg-black/20"
                            style={{ borderColor: tipoColors[nodo.tipo] || '#95A5A6' }}
                        >
                            <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                                style={{ backgroundColor: tipoColors[nodo.tipo] || '#95A5A6' }}
                            >
                                {nodo.label.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <p className="text-xs font-bold leading-tight">{nodo.label}</p>
                                <div className="flex items-center gap-1">
                                    <span className="text-[9px] text-muted-foreground capitalize">{nodo.tipo}</span>
                                    <span className="text-[10px]">{rolIcons[nodo.sentimiento_hacia] || ''}</span>
                                </div>
                            </div>
                            {/* Relevance indicator */}
                            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white dark:bg-slate-800 border flex items-center justify-center shadow-sm">
                                <span className="text-[8px] font-bold">{(nodo.relevancia * 10).toFixed(0)}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Relationships */}
                {network.enlaces?.length > 0 && (
                    <div className="space-y-2 border-t pt-3">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Relaciones detectadas</span>
                        <div className="grid grid-cols-1 gap-1.5">
                            {network.enlaces.map((enlace: any, i: number) => {
                                const origenNodo = network.nodos.find((n: any) => n.id === enlace.origen);
                                const destinoNodo = network.nodos.find((n: any) => n.id === enlace.destino);
                                return (
                                    <div key={i} className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg text-xs">
                                        <span className="font-bold text-slate-700 dark:text-slate-300">{origenNodo?.label || enlace.origen}</span>
                                        <div className="flex items-center gap-1">
                                            <div className="h-0.5 w-4 rounded" style={{ backgroundColor: relationColors[enlace.tipo_relacion] || '#95A5A6' }} />
                                            <span
                                                className="text-[9px] px-1.5 py-0.5 rounded font-bold text-white"
                                                style={{ backgroundColor: relationColors[enlace.tipo_relacion] || '#95A5A6' }}
                                            >
                                                {enlace.tipo_relacion.replace(/_/g, ' ')}
                                            </span>
                                            <div className="h-0.5 w-4 rounded" style={{ backgroundColor: relationColors[enlace.tipo_relacion] || '#95A5A6' }} />
                                            <ArrowRight className="w-3 h-3" style={{ color: relationColors[enlace.tipo_relacion] || '#95A5A6' }} />
                                        </div>
                                        <span className="font-bold text-slate-700 dark:text-slate-300">{destinoNodo?.label || enlace.destino}</span>
                                        <span className="text-[9px] text-zinc-500 ml-auto italic max-w-[200px] truncate" title={enlace.evidencia}>
                                            "{enlace.evidencia}"
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

// ===== NARRATIVE TIMELINE =====
const NarrativeTimeline: React.FC<{ data: any }> = ({ data }) => {
    const timeline = data?.ui_enrichment?.narrative_timeline;
    if (!timeline?.eventos?.length) return null;

    const tipoColors: Record<string, string> = {
        antecedente_lejano: '#94A3B8',
        antecedente_inmediato: '#60A5FA',
        evento_central: '#EF4444',
        consecuencia_directa: '#F59E0B',
        proyeccion: '#A78BFA',
    };

    const timelineTipoLabels: Record<string, string> = {
        antecedente_lejano: 'Antecedente',
        antecedente_inmediato: 'Antecedente inmediato',
        evento_central: '⚡ Evento Central',
        consecuencia_directa: 'Consecuencia',
        proyeccion: '🔮 Proyección',
    };

    const certezaIcons: Record<string, string> = {
        confirmado: '✓',
        inferido: '~',
        especulativo: '?',
    };

    return (
        <Card className="shadow-lg border-none bg-card/50 backdrop-blur">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Clock className="w-4 h-4 text-orange-500" />
                        Línea Temporal Narrativa
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] px-2 py-0.5 bg-muted rounded-full font-bold capitalize">
                            {timeline.estructura_temporal_dominante}
                        </span>
                        {timeline.tiene_flashback && (
                            <span className="text-[9px] px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-bold">Flashback</span>
                        )}
                        {timeline.tiene_proyeccion_futura && (
                            <span className="text-[9px] px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full font-bold">Proyección</span>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="relative pl-6">
                    {/* Vertical line */}
                    <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-slate-300 via-red-400 to-purple-400 dark:from-slate-700 dark:via-red-700 dark:to-purple-700" />

                    <div className="space-y-3">
                        {timeline.eventos.map((evento: any) => (
                            <div
                                key={evento.id}
                                className={`relative p-3 rounded-xl border transition-all hover:shadow-md ${evento.es_hecho_central
                                    ? 'bg-red-950/10 border-red-500/20 shadow-md'
                                    : 'bg-zinc-900/50 border-zinc-800'
                                    }`}
                            >
                                {/* Timeline dot */}
                                <div
                                    className={`absolute -left-[22px] top-4 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 shadow ${evento.es_hecho_central ? 'w-4 h-4 -left-[24px]' : ''}`}
                                    style={{ backgroundColor: tipoColors[evento.tipo_temporal] || '#94A3B8' }}
                                />
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span
                                                className="text-[9px] px-1.5 py-0.5 rounded font-bold text-white"
                                                style={{ backgroundColor: tipoColors[evento.tipo_temporal] || '#94A3B8' }}
                                            >
                                                {timelineTipoLabels[evento.tipo_temporal] || evento.tipo_temporal}
                                            </span>
                                            <span className="text-[9px] text-zinc-500 font-mono">
                                                {certezaIcons[evento.certeza] || ''} {evento.certeza}
                                            </span>
                                        </div>
                                        <p className={`text-sm leading-tight ${evento.es_hecho_central ? 'font-black text-red-100' : 'font-medium'}`}>
                                            {evento.descripcion}
                                        </p>
                                        {evento.referencia_textual && (
                                            <p className="text-[10px] text-zinc-500 mt-1 italic">"{evento.referencia_textual}"</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

// ===== COMPARATIVA SECTORIAL =====
const ComparativaBadges: React.FC<{ data: any }> = ({ data }) => {
    const comp = data?.ui_enrichment?.comparativa_sectorial;
    if (!comp) return null;

    const badgeColors: Record<string, string> = {
        menor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
        similar: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        mayor: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
    };

    const badgeIcons: Record<string, string> = {
        menor: '↓',
        similar: '≈',
        mayor: '↑',
    };

    return (
        <Card className="shadow-md border-none bg-card/50 backdrop-blur">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-teal-500" />
                    Comparativa Sectorial
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Sesgo', key: 'sesgo_relativo' },
                        { label: 'Alarmismo', key: 'alarmismo_relativo' },
                        { label: 'Calidad', key: 'calidad_relativa' },
                    ].map(({ label, key }) => {
                        const val = comp.vs_promedio_medio?.[key] || 'similar';
                        return (
                            <div key={key} className="text-center">
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${badgeColors[val] || badgeColors.similar}`}>
                                    {badgeIcons[val]} {val}
                                </span>
                                <p className="text-[10px] text-muted-foreground mt-1 font-medium">{label}</p>
                            </div>
                        );
                    })}
                </div>

                <div className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg">
                    <CircleDot className={`w-3 h-3 ${comp.patron_narrativo_frecuente ? 'text-amber-500' : 'text-emerald-500'}`} />
                    <span className="text-[10px] font-medium">
                        {comp.patron_narrativo_frecuente
                            ? 'Patrón narrativo frecuente detectado'
                            : 'Ángulo narrativo novedoso'}
                    </span>
                </div>
                {comp.nota_patron && (
                    <p className="text-xs text-zinc-500 italic">{comp.nota_patron}</p>
                )}
            </CardContent>
        </Card>
    );
};

import { useStreamingAnalysis } from '@/hooks/useStreamingAnalysis';

// ===== MAIN DASHBOARD =====
export const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ analysis }) => {
    const { selectedActorSlug } = useSituationMonitorStore();
    const data = analysis?.analysisData || analysis?.data || {};

    const [activeSegmentId, setActiveSegmentId] = React.useState<number | null>(null);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [showRawJson, setShowRawJson] = React.useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = React.useState(false);

    // Only stream if status is NOT 'COMPLETED'
    const shouldStream = analysis && analysis.status !== 'COMPLETED';
    const { isStreaming, progress, error: streamError } = useStreamingAnalysis(
        analysis?.id,
        analysis?.url,
        shouldStream
    );

    if (selectedActorSlug) {
        return (
            <div className="max-w-4xl mx-auto py-10">
                <ActorTimelinePanel />
            </div>
        );
    }

    if (!data && !isStreaming) return (
        <div className="flex flex-col items-center justify-center p-20 gap-4 opacity-40">
            <div className="p-8 bg-muted rounded-full animate-bounce">
                <Brain className="w-12 h-12 text-blue-500/40" />
            </div>
            <p className="text-sm font-black uppercase tracking-widest italic">Alistando Inteligencia...</p>
        </div>
    );

    const handleDelete = async () => {
        if (!window.confirm('¿Estás seguro de que deseas eliminar este artículo? Esta acción no se puede deshacer.')) {
            return;
        }

        setIsDeleting(true);
        try {
            const response = await fetch(`/api/analysis/${analysis.id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                alert('Artículo eliminado con éxito.');
                // Refresh the page or navigate away. 
                // Since we don't have routing context here, reload is the safest fallback.
                window.location.href = '/';
            } else {
                const errorData = await response.json();
                alert(`Error al eliminar: ${errorData.error || 'Desconocido'}`);
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('Error de red al intentar eliminar el artículo.');
        } finally {
            setIsDeleting(false);
        }
    };

    // Safety guard for missing analysis prop
    if (!analysis) {
        return <div className="p-8 text-center italic text-muted-foreground">Cargando datos de análisis...</div>;
    }


    const uiHints = data?.ui_enrichment?.ui_hints;
    const scores = {
        calidad: analysis?.scoreCalidad || data?.scoreCalidad || 0,
        desin: analysis?.scoreDesin || data?.scoreDesin || 0,
        clickbait: analysis?.scoreClickbait || data?.scoreClickbait || 0,
        sesgo: analysis?.scoreSesgo || data?.scoreSesgo || 0,
        global: analysis?.scoreGlobal || 0,
    };

    const editorialScores = [
        { subject: 'Informativo', A: (data.intencion_editorial?.score_informativo || 0) * 100 },
        { subject: 'Opinión', A: (data.intencion_editorial?.score_opinion || 0) * 100 },
        { subject: 'Movilización', A: (data.intencion_editorial?.score_movilizacion || 0) * 100 },
        { subject: 'Alarmismo', A: (data.intencion_editorial?.score_alarmismo || 0) * 100 },
    ];

    const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

    const emotionData = Object.entries(data?.emociones || {}).map(([name, value]) => ({
        name,
        value: (value as number) * 100
    })).sort((a, b) => b.value - a.value);

    // Dynamic theming from ui_hints
    const themeStyle: React.CSSProperties = uiHints ? {
        '--color-dominante': uiHints.color_dominante,
        '--color-acento': uiHints.color_acento,
    } as React.CSSProperties : {};

    const urgencyBorder = uiHints?.nivel_urgencia_visual === 'critica'
        ? 'border-l-4 border-l-red-500'
        : uiHints?.nivel_urgencia_visual === 'alta'
            ? 'border-l-4 border-l-orange-500'
            : '';

    return (
        <div className={`space-y-8 animate-in fade-in duration-500 ${urgencyBorder}`} style={themeStyle}>

            {/* Image Banner */}
            {analysis.imagenUrl && (
                <div className="w-full h-64 md:h-80 rounded-3xl overflow-hidden border shadow-lg relative bg-zinc-950">
                    <img
                        src={analysis.imagenUrl}
                        alt="Imagen Destacada"
                        className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity duration-500"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                </div>
            )}

            {/* Header Info */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                    <span
                        className="px-2 py-1 text-white text-[10px] font-bold rounded uppercase shadow-sm"
                        style={{ backgroundColor: uiHints?.color_dominante || '#3b82f6' }}
                    >
                        {analysis.fuente}
                    </span>
                    {uiHints?.nivel_urgencia_visual && (
                        <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase ${uiHints.nivel_urgencia_visual === 'critica' ? 'bg-red-100 text-red-700 animate-pulse' :
                            uiHints.nivel_urgencia_visual === 'alta' ? 'bg-orange-100 text-orange-700' :
                                uiHints.nivel_urgencia_visual === 'media' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-slate-100 text-slate-600'
                            }`}>
                            {uiHints.nivel_urgencia_visual}
                        </span>
                    )}
                    <span className="text-muted-foreground text-xs">
                        {new Date(analysis.fechaExtraccion).toLocaleDateString()}
                    </span>
                </div>

                {isStreaming && (
                    <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 animate-in fade-in slide-in-from-top duration-500">
                        <div className="flex items-center gap-3 mb-3">
                            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                            <span className="text-sm font-bold text-blue-700 dark:text-blue-300 uppercase tracking-tighter">Analizando en tiempo real...</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {progress.map((step: string, i: number) => (
                                <div key={i} className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-black/20 rounded-lg border text-[10px] font-bold text-slate-600 dark:text-slate-400">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                    {step}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {streamError && (
                    <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 flex items-center gap-3 text-rose-700 dark:text-rose-400">
                        <AlertTriangle className="w-5 h-5" />
                        <span className="text-sm font-medium">{streamError}</span>
                    </div>
                )}

                <h1 className="text-3xl font-black tracking-tight leading-none text-balance text-slate-900 dark:text-white">
                    {analysis.titular || "Análisis de Noticia"}
                </h1>

                {/* Frase más cargada highlight */}
                {data?.ui_enrichment?.reading_experience?.frase_mas_cargada && (
                    <div
                        className="p-4 rounded-2xl border-l-4 shadow-sm backdrop-blur-sm"
                        style={{ borderColor: uiHints?.color_dominante || '#8b5cf6', backgroundColor: (uiHints?.color_acento || '#8b5cf6') + '10' }}
                    >
                        <div className="flex items-center gap-2 mb-1 opacity-70">
                            <Zap className="w-3 h-3" style={{ color: uiHints?.color_dominante }} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Retórica Destacada</span>
                        </div>
                        <p className="text-base font-bold italic leading-relaxed text-slate-800 dark:text-slate-200">
                            "{data?.ui_enrichment?.reading_experience?.frase_mas_cargada}"
                        </p>
                    </div>
                )}

                <div className="flex items-center gap-4 text-sm">
                    <a
                        href={analysis.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-500 hover:underline"
                    >
                        <ExternalLink className="w-4 h-4" />
                        View fuente original
                    </a>
                    <button
                        onClick={() => setIsShareModalOpen(true)}
                        className="flex items-center gap-1 text-emerald-500 hover:text-emerald-700 transition-colors text-xs font-bold whitespace-nowrap"
                    >
                        <Share2 className="w-4 h-4" />
                        Compartir
                    </button>
                    {data.esOpinion && (
                        <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold rounded-full">
                            OPINIÓN
                        </span>
                    )}
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="ml-auto flex items-center gap-1 text-rose-500 hover:text-rose-700 transition-colors text-xs font-bold disabled:opacity-50"
                        title="Eliminar artículo"
                    >
                        <Trash2 className="w-4 h-4" />
                        {isDeleting ? 'Eliminando...' : 'Eliminar Artículo'}
                    </button>
                </div>
            </div>

            {/* Reading Experience Panel — NEW v3 */}
            <ReadingExperiencePanel data={data} />

            {/* Main Narrative Card */}
            <Card
                className="border-none shadow-xl overflow-hidden"
                style={{
                    background: uiHints
                        ? `linear-gradient(135deg, ${uiHints.color_dominante}10, ${uiHints.color_acento}20)`
                        : undefined
                }}
            >
                <CardContent className="p-8">
                    <div className="flex items-start gap-4">
                        <div
                            className="p-3 text-white rounded-2xl shadow-lg ring-4 ring-opacity-20"
                            style={{
                                backgroundColor: uiHints?.color_dominante || '#3b82f6',
                                '--tw-ring-color': (uiHints?.color_dominante || '#3b82f6') + '40'
                            } as React.CSSProperties}
                        >
                            <Newspaper className="w-6 h-6" />
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-xl font-bold uppercase tracking-wider text-xs" style={{ color: uiHints?.color_dominante }}>
                                Resumen Ejecutivo
                            </h3>
                            <p className="text-lg leading-relaxed text-slate-700 dark:text-slate-300 font-medium">
                                {data.resumen_ejecutivo || "No hay resumen disponible para esta noticia."}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {data.keywords?.map((tag: any, i: number) => {
                                    const tagLabel = typeof tag === 'string' ? tag : (tag?.text || tag?.label || JSON.stringify(tag));
                                    return (
                                        <span
                                            key={i}
                                            className="px-3 py-1 bg-white/50 dark:bg-black/20 backdrop-blur-sm border rounded-full text-xs font-semibold"
                                            style={{ borderColor: (uiHints?.color_dominante || '#3b82f6') + '40', color: uiHints?.color_dominante }}
                                        >
                                            #{tagLabel}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Risk Semaphore — Scores Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Calidad Periodística"
                    value={scores.calidad}
                    icon={<ShieldAlert className="w-5 h-5" />}
                    color="blue"
                    description="Rigor y pluralidad"
                />
                <MetricCard
                    title="Riesgo Desinfo."
                    value={scores.desin}
                    icon={<AlertTriangle className="w-5 h-5" />}
                    color="rose"
                    description={data.riesgo_desinformacion?.nivel_riesgo_global
                        ? `Nivel: ${data.riesgo_desinformacion.nivel_riesgo_global}`
                        : "Probabilidad de falsedad"}
                />
                <MetricCard
                    title="Sesgo Político"
                    value={data.sesgo?.orientacion_politica_estimada || 'Neutral'}
                    icon={<Target className="w-5 h-5" />}
                    color="purple"
                    description={data.sesgo?.confianza_orientacion ? `Confianza: ${(data.sesgo.confianza_orientacion * 100).toFixed(0)}%` : 'Sin datos'}
                    isScore={false}
                />
                <MetricCard
                    title="Score Global"
                    value={scores.global}
                    icon={<TrendingUp className="w-5 h-5" />}
                    color="emerald"
                    description="Nivel de confianza sugerido"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Intención Editorial Radar */}
                <Card className="lg:col-span-1 shadow-md border-none bg-card/50 backdrop-blur">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <Target className="w-4 h-4 text-purple-500" />
                            Intención Editorial
                            {data.intencion_editorial?.primaria && (
                                <span className="text-[9px] px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full font-bold capitalize ml-auto">
                                    {data.intencion_editorial.primaria}
                                </span>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={editorialScores}>
                                <PolarGrid stroke="#1e293b" />
                                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <Radar
                                    name="Intención"
                                    dataKey="A"
                                    stroke={uiHints?.color_dominante || '#10b981'}
                                    fill={uiHints?.color_dominante || '#10b981'}
                                    fillOpacity={0.6}
                                />
                            </RadarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Framing & Narrativa */}
                <Card className="lg:col-span-2 shadow-md border-none bg-card/50 backdrop-blur overflow-hidden">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-blue-500" />
                            Framing y Narrativa
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase">Enfoque Predominante</span>
                                <p className="text-md font-semibold mt-1 capitalize text-zinc-100">{data.framing?.enfoque_predominante?.replace(/_/g, ' ') || 'No detectado'}</p>
                            </div>
                            <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase">Perspectiva Temporal</span>
                                <p className="text-md font-semibold mt-1 capitalize text-zinc-100">{data.framing?.perspectiva_temporal || 'No especificada'}</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                <Target className="w-3 h-3" /> Marcos Narrativos Detectados
                            </span>
                            <div className="grid grid-cols-1 gap-2">
                                {data.framing?.marcos_narrativos?.map((m: any, i: number) => (
                                    <div key={i} className="flex gap-3 items-center p-3 bg-zinc-900/40 border border-zinc-800 rounded-xl shadow-sm">
                                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
                                            <span className="text-xs font-bold text-blue-400">{(Number(m.confianza || 0) * 10).toFixed(0)}</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold leading-tight">
                                                {typeof m.marco === 'string' ? m.marco : (m.marco?.label || m.marco?.text || JSON.stringify(m.marco))}
                                            </p>
                                            <div className="flex gap-1 mt-1">
                                                {m.evidencias?.slice(0, 2).map((ev: string, j: number) => (
                                                    <span key={j} className="text-[9px] opacity-70 italic">"{ev}"</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )) || <span className="text-xs text-muted-foreground italic">No se identificaron marcos específicos.</span>}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <span className="text-[10px] font-bold text-emerald-600 uppercase flex items-center gap-1">
                                    <UserPlus className="w-3 h-3" /> Voces Incluidas
                                </span>
                                <div className="flex flex-col gap-1">
                                    {data.sesgo?.voces_incluidas?.map((v: any, i: number) => (
                                        <div key={i} className="text-[11px] p-2 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                                            <span className="font-bold text-emerald-400">
                                                {typeof v.actor === 'string' ? v.actor : (v.actor?.label || v.actor?.name || 'Actor')}
                                            </span>
                                            {v.tipo && <span className="ml-1 text-zinc-500 text-[9px]">({v.tipo})</span>}
                                            {v.tono_hacia_actor && (
                                                <span className={`ml-1 text-[8px] px-1 py-0.5 rounded ${v.tono_hacia_actor === 'favorable' ? 'bg-emerald-500/20 text-emerald-400' :
                                                    v.tono_hacia_actor === 'desfavorable' ? 'bg-rose-500/20 text-rose-400' :
                                                        'bg-zinc-800 text-zinc-400'
                                                    }`}>{v.tono_hacia_actor}</span>
                                            )}
                                            {v.es_citado_directamente && <span className="ml-1 text-[8px] opacity-70">💬</span>}
                                        </div>
                                    )) || <span className="text-xs text-zinc-500 italic">No se identificaron voces específicas.</span>}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <span className="text-[10px] font-bold text-rose-600 uppercase flex items-center gap-1">
                                    <UserMinus className="w-3 h-3" /> Voces Ausentes
                                </span>
                                <div className="flex flex-wrap gap-1">
                                    {data.sesgo?.voces_ausentes?.map((v: string, i: number) => (
                                        <span key={i} className="text-[10px] px-2 py-1 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900 rounded-lg text-rose-800 dark:text-rose-300">
                                            {v}
                                        </span>
                                    )) || <span className="text-xs text-muted-foreground italic">No se detectaron ausencias notables.</span>}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-purple-500/5 border border-purple-500/10 rounded-2xl">
                            <div className="flex justify-between items-center">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-purple-400 uppercase">Llamada a la Acción (Implícita)</span>
                                    <p className="text-md font-black text-purple-100 capitalize">{data.framing?.llamada_a_accion_implicita || 'Neutral'}</p>
                                </div>
                                <div className="text-right space-y-1">
                                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Rol del Lector</span>
                                    <p className="text-xs font-semibold text-zinc-300 capitalize">{data.framing?.rol_lector_implicito?.replace(/_/g, ' ') || 'Ciudadano'}</p>
                                </div>
                            </div>
                        </div>

                    </CardContent>
                </Card>
            </div>

            {/* Actor Network — NEW v3 */}
            <ActorNetworkGraph data={data} />

            {/* Narrative Timeline — NEW v3 */}
            <NarrativeTimeline data={data} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Emotions Bar */}
                <Card className="shadow-md border-none bg-card/50 backdrop-blur">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                            Carga Emocional
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={emotionData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1e293b" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#94a3b8' }} width={80} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'Fuerza']}
                                />
                                <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20}>
                                    {emotionData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Linguistic Check */}
                <Card className="shadow-md border-none bg-card/50 backdrop-blur">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <Info className="w-4 h-4 text-blue-500" />
                            Análisis Lingüístico
                            {data.analisis_linguistico?.registro_linguistico && (
                                <span className="text-[9px] px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-bold capitalize ml-auto">
                                    {data.analisis_linguistico.registro_linguistico}
                                </span>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-3 bg-muted/20 rounded-xl">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Superlativos</span>
                                <p className="text-xl font-bold">{data.analisis_linguistico?.uso_superlativos || 0}</p>
                            </div>
                            <div className="p-3 bg-muted/20 rounded-xl">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Voz Pasiva</span>
                                <div className="flex items-center gap-2 mt-1">
                                    {data.analisis_linguistico?.uso_voz_pasiva ?
                                        <AlertTriangle className="w-4 h-4 text-yellow-500" /> :
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    }
                                    <span className="text-sm font-semibold">{data.analisis_linguistico?.uso_voz_pasiva ? 'Sí' : 'No'}</span>
                                </div>
                            </div>
                            <div className="p-3 bg-muted/20 rounded-xl">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Carga adj.</span>
                                <p className="text-xl font-bold">{data.analisis_linguistico?.densidad_adjetivos_carga ? (data.analisis_linguistico.densidad_adjetivos_carga * 100).toFixed(0) + '%' : '-'}</p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Verbos de Hecho vs Opinión</span>
                            <div className="flex h-2 w-full rounded-full bg-muted overflow-hidden">
                                <div
                                    className="bg-blue-500 h-full"
                                    style={{ width: `${(data.analisis_linguistico?.verbos_hecho?.length || 0) / ((data.analisis_linguistico?.verbos_hecho?.length || 0) + (data.analisis_linguistico?.verbos_opinion?.length || 0) + 1) * 100}%` }}
                                />
                                <div
                                    className="bg-yellow-500 h-full"
                                    style={{ width: `${(data.analisis_linguistico?.verbos_opinion?.length || 0) / ((data.analisis_linguistico?.verbos_hecho?.length || 0) + (data.analisis_linguistico?.verbos_opinion?.length || 0) + 1) * 100}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] font-bold">
                                <span className="text-blue-600">HECHO ({data.analisis_linguistico?.verbos_hecho?.length || 0})</span>
                                <span className="text-yellow-600">OPINIÓN ({data.analisis_linguistico?.verbos_opinion?.length || 0})</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Rhetorical Heatmap — NEW v3 */}
            <RhetoricalHeatmap data={data} activeSegmentId={activeSegmentId} onSegmentHover={setActiveSegmentId} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Comparativa Sectorial — NEW v3 */}
                <ComparativaBadges data={data} />

                {/* Desinformation Alerts */}
                {data.riesgo_desinformacion?.alertas?.length > 0 && (
                    <Card className="shadow-md border-none bg-card/50 backdrop-blur">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                                Alertas de Desinformación
                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ml-auto ${data.riesgo_desinformacion.nivel_riesgo_global === 'critico' ? 'bg-red-500/20 text-red-400' :
                                    data.riesgo_desinformacion.nivel_riesgo_global === 'alto' ? 'bg-orange-500/20 text-orange-400' :
                                        data.riesgo_desinformacion.nivel_riesgo_global === 'moderado' ? 'bg-yellow-500/20 text-yellow-400' :
                                            'bg-emerald-500/20 text-emerald-400'
                                    }`}>
                                    {data.riesgo_desinformacion.nivel_riesgo_global}
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {data.riesgo_desinformacion.alertas.map((alerta: any, i: number) => {
                                    if (typeof alerta === 'string') {
                                        return (
                                            <div key={i} className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-950/20 rounded-lg text-xs">
                                                <AlertTriangle className="w-3 h-3 text-red-500 mt-0.5 shrink-0" />
                                                <span className="text-red-800 dark:text-red-300">{alerta}</span>
                                            </div>
                                        );
                                    }

                                    // Fallback for old object formats if any
                                    const label = alerta?.text || alerta?.label;
                                    if (label && !alerta.tipo) {
                                        return (
                                            <div key={i} className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-950/20 rounded-lg text-xs">
                                                <AlertTriangle className="w-3 h-3 text-red-500 mt-0.5 shrink-0" />
                                                <span className="text-red-800 dark:text-red-300">{label}</span>
                                            </div>
                                        );
                                    }

                                    // New AI object format
                                    const severidadColors = {
                                        alta: "bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-900/50",
                                        media: "bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-900/50",
                                        baja: "bg-yellow-50 dark:bg-yellow-950/30 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-900/50",
                                        high: "bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-900/50",
                                        warning: "bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-900/50",
                                        info: "bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-900/50",
                                        low: "bg-yellow-50 dark:bg-yellow-950/30 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-900/50"
                                    };

                                    const colorClass = severidadColors[(alerta.severidad as keyof typeof severidadColors)] || severidadColors.warning;

                                    return (
                                        <div key={i} className={`flex flex-col gap-1 p-3 rounded-lg border text-xs ${colorClass}`}>
                                            <div className="flex items-center gap-2 font-bold mb-1">
                                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                                <span className="uppercase tracking-wider">{alerta.tipo || 'Alerta de Riesgo'}</span>
                                            </div>
                                            <p className="opacity-90 leading-relaxed font-medium">
                                                {alerta.descripcion || JSON.stringify(alerta)}
                                            </p>

                                            {(alerta.fragmento_evidencia || alerta.accion_sugerida) && (
                                                <div className="mt-2 pt-2 border-t border-current/10 space-y-1">
                                                    {alerta.fragmento_evidencia && (
                                                        <div className="font-mono text-[10px] opacity-75">
                                                            <span className="font-bold">EVIDENCIA:</span> "{alerta.fragmento_evidencia}"
                                                        </div>
                                                    )}
                                                    {alerta.accion_sugerida && (
                                                        <div className="font-mono text-[10px] opacity-75">
                                                            <span className="font-bold">ACCIÓN:</span> {alerta.accion_sugerida.replace(/_/g, ' ')}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Original Content & Raw Data */}
            <div className="space-y-6 pb-20">
                <div className="space-y-4">
                    <h3 className="text-sm font-bold flex items-center gap-2 italic text-zinc-500">
                        <Newspaper className="w-4 h-4" />
                        Texto Original de la Noticia
                    </h3>
                    <div className="prose prose-sm dark:prose-invert max-w-none bg-zinc-900/40 p-6 rounded-2xl border border-zinc-800 shadow-inner text-zinc-300 leading-relaxed">
                        <EnrichedArticleBody
                            body={data.cuerpo || ''}
                            segments={data?.ui_enrichment?.rhetorical_heatmap?.segmentos || []}
                            activeSegmentId={activeSegmentId}
                            onSegmentHover={setActiveSegmentId}
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-sm font-bold flex items-center gap-2 italic text-muted-foreground">
                        <Target className="w-4 h-4" />
                        Estructura de Datos (JSON)
                    </h3>
                    <div className="space-y-4">
                        <button
                            onClick={() => setShowRawJson(!showRawJson)}
                            className="text-[10px] bg-slate-800 text-white px-3 py-2 rounded-lg font-mono hover:bg-slate-700 transition-colors inline-block"
                        >
                            {showRawJson ? 'OCULTAR DATOS RAW' : 'MOSTRAR DATOS RAW (INTERNAL_DATA_OBJECT)'}
                        </button>

                        {showRawJson && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                <pre className="text-[11px] font-mono bg-slate-950 text-emerald-500 p-6 rounded-2xl border border-slate-800 overflow-x-auto custom-scrollbar max-h-[600px] shadow-2xl">
                                    {(() => {
                                        try {
                                            const cache = new Set();
                                            return JSON.stringify(analysis, (key, value) => {
                                                if (typeof value === 'object' && value !== null) {
                                                    if (cache.has(value)) return '[Circular]';
                                                    cache.add(value);
                                                }
                                                return value;
                                            }, 2);
                                        } catch (e) {
                                            return "Error serializando datos: " + (e as Error).message;
                                        }
                                    })()}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ShareStoryModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                analysisId={analysis.id}
            />
        </div >
    );
};

// ===== HELPER COMPONENTS =====

interface MetricCardProps {
    title: string;
    value: number | string;
    icon: React.ReactNode;
    color: 'blue' | 'rose' | 'purple' | 'emerald';
    description: string;
    isScore?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, color, description, isScore = true }) => {
    const colorMap = {
        blue: 'text-blue-400 bg-blue-500/5 border-blue-500/10 shadow-sm',
        rose: 'text-rose-400 bg-rose-500/5 border-rose-500/10 shadow-sm',
        purple: 'text-purple-400 bg-purple-500/5 border-purple-500/10 shadow-sm',
        emerald: 'text-emerald-400 bg-emerald-500/5 border-emerald-500/10 shadow-sm',
    };

    const ringColor = {
        blue: 'ring-blue-500/20',
        rose: 'ring-rose-500/20',
        purple: 'ring-purple-500/20',
        emerald: 'ring-emerald-500/20',
    };

    const textColor = {
        blue: 'text-blue-700',
        rose: 'text-rose-700',
        purple: 'text-purple-700',
        emerald: 'text-emerald-700',
    };

    return (
        <div className={`p-4 rounded-2xl border ${colorMap[color]} shadow-sm transition-all hover:shadow-md group`}>
            <div className="flex justify-between items-start mb-2">
                <div className={`p-2 rounded-xl bg-zinc-950/50 shadow-sm ring-1 ${ringColor[color]} group-hover:scale-110 transition-transform`}>
                    {icon}
                </div>
                {isScore && (
                    <span className={`text-xl font-black ${textColor[color]}`}>
                        {((value as number) * 100).toFixed(0)}%
                    </span>
                )}
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wider opacity-70 mb-1">{title}</h4>
            {!isScore && <p className={`text-lg font-black ${textColor[color]} mb-1`}>{value}</p>}
            <p className="text-[10px] opacity-60 font-medium">{description}</p>
        </div>
    );
};

const CollapsibleContent: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
    const [isOpen, setIsOpen] = React.useState(false);

    return (
        <div className="border rounded-2xl overflow-hidden bg-card/30 backdrop-blur">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-4 flex justify-between items-center hover:bg-muted/50 transition-colors"
            >
                <span className="text-sm font-bold flex items-center gap-2 italic">
                    <Newspaper className="w-4 h-4 text-muted-foreground" />
                    {title}
                </span>
                {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {isOpen && (
                <div className="p-4 border-t animate-in slide-in-from-top-2 duration-300">
                    {children}
                </div>
            )}
        </div>
    );
};
