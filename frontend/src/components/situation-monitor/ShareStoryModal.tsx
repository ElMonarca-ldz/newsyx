import React from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { X, Share2, Copy, Twitter, MessageCircle, AlertCircle, TrendingUp, Calendar, MapPin } from 'lucide-react';
import { useSituationMonitorStore } from '@/stores/situationMonitorStore';

interface ShareStoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    analysisId?: string;
}

export const ShareStoryModal: React.FC<ShareStoryModalProps> = ({ isOpen, onClose, analysisId }) => {
    const { shareEventData, setShareEventData, theme } = useSituationMonitorStore();

    const { data: story, isLoading } = useQuery({
        queryKey: ['story', analysisId || 'daily-AR'],
        queryFn: () => {
            const baseUrl = (import.meta as any).env.VITE_API_URL || 'http://localhost:4000/api';
            const url = analysisId
                ? `${baseUrl}/stories/analysis/${encodeURIComponent(analysisId)}`
                : `${baseUrl}/stories?country=AR`;
            return fetch(url).then(res => res.json());
        },
        enabled: isOpen && !shareEventData,
    });

    if (!isOpen) return null;

    const handleClose = () => {
        setShareEventData(null);
        onClose();
    };

    const getShareUrl = () => {
        if (shareEventData) {
            const article = shareEventData.articulo;
            if (article.slug) {
                return `${window.location.origin}/explorer/${article.slug}`;
            }
            return `${window.location.origin}/explorer?id=${article.id}`;
        }
        return story?.share_url || '';
    };

    const copyToClipboard = () => {
        if (shareEventData) {
            const shareUrl = getShareUrl();
            const text = `Evento: ${shareEventData.descripcion}\nCerteza: ${shareEventData.certeza_evento}\nFecha: ${shareEventData.fecha_exacta || shareEventData.fecha_aproximada || 'N/A'}\nFuente: ${shareEventData.articulo.medio} - ${shareEventData.articulo.titulo}\nVer en Newsyx: ${shareUrl}\nVia: Newsyx`;
            navigator.clipboard.writeText(text);
            alert('Copiado al portapapeles');
        } else if (story) {
            const text = analysisId
                ? `Newsyx Intelligence Brief: ${story.title} - ITL: ${story.summary.itl_score}. ${story.share_url}`
                : `Reporte de Inteligencia Newsyx - ITL: ${story.summary.itl_score}. ${story.share_url}`;
            navigator.clipboard.writeText(text);
            alert('Copiado al portapapeles');
        }
    };

    const modalContent = (
        <div className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300 ${theme === 'dark' ? 'bg-zinc-950/80' : 'bg-slate-900/40'}`}>

            <div className={`border rounded-3xl w-full max-w-md overflow-hidden shadow-2xl scale-in-center transition-colors ${theme === 'dark' ? 'bg-zinc-900 border-zinc-700/50 shadow-emerald-500/10' : 'bg-white border-zinc-200 shadow-xl shadow-zinc-200/50'}`}>
                {/* Header */}
                <div className={`flex items-center justify-between p-6 border-b transition-colors ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-100 bg-zinc-50'}`}>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-xl">
                            <Share2 className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'}`}>Compartir Briefing</h3>
                            <p className="text-xs text-zinc-500">Resumen ejecutivo del estado del país</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'}`}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {shareEventData ? (
                        <div className={`p-5 rounded-2xl border transition-colors ${theme === 'dark' ? 'bg-gradient-to-br from-indigo-500/5 to-zinc-900 border-indigo-500/20' : 'bg-slate-50 border-indigo-100'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">
                                    Newsyx Event Intel
                                </span>
                                {shareEventData.fecha_exacta && (
                                    <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(shareEventData.fecha_exacta).toLocaleDateString()}
                                    </span>
                                )}
                            </div>

                            {shareEventData.articulo.imagen && (
                                <div className="mb-4 w-full h-36 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950">
                                    <img src={shareEventData.articulo.imagen} alt="Thumbnail" className="w-full h-full object-cover opacity-80" />
                                </div>
                            )}

                            <div className="mb-4">
                                <h4 className={`font-bold text-sm leading-snug ${theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'}`}>{shareEventData.descripcion}</h4>
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md border font-medium uppercase tracking-tight bg-zinc-800 text-zinc-300 border-zinc-700">
                                        {shareEventData.certeza_evento}
                                    </span>
                                    <span className="text-[10px] text-zinc-500 uppercase font-semibold">Fuente: {shareEventData.articulo.medio}</span>
                                </div>
                                {shareEventData.lugar && (
                                    <div className="flex items-center gap-1 mt-2 text-xs text-zinc-400">
                                        <MapPin className="w-3 h-3" />
                                        <span>{shareEventData.lugar.nombre_display}</span>
                                    </div>
                                )}
                            </div>

                            {shareEventData.fragmento_evidencia && (
                                <div className={`p-3 rounded-lg border text-xs italic transition-colors ${theme === 'dark' ? 'bg-zinc-800/50 border-zinc-700/50 text-zinc-300' : 'bg-zinc-100 border-zinc-200 text-zinc-600'}`}>
                                    "{shareEventData.fragmento_evidencia}"
                                </div>
                            )}
                        </div>
                    ) : isLoading ? (
                        <div className="space-y-4 animate-pulse">
                            <div className={`h-40 rounded-2xl ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100'}`} />
                            <div className={`h-10 rounded-xl ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100'}`} />
                        </div>
                    ) : story && (
                        <div className={`p-5 rounded-2xl border transition-colors ${theme === 'dark' ? 'bg-gradient-to-br from-emerald-500/5 to-zinc-900 border-emerald-500/20' : 'bg-emerald-50/50 border-emerald-100'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                                    {analysisId ? 'Article Intelligence Brief' : 'Newsyx Intelligence Brief'}
                                </span>
                                <span className="text-[10px] text-zinc-500">{new Date(story.timestamp).toLocaleDateString()}</span>
                            </div>

                            {analysisId && (
                                <div className="mb-4">
                                    <h4 className={`font-bold text-sm leading-snug ${theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'}`}>{story.title}</h4>
                                    <p className="text-[10px] text-zinc-500 mt-1 uppercase font-semibold">{story.source}</p>
                                </div>
                            )}

                            {!analysisId ? (
                                <div className="flex items-center gap-6 mb-4">
                                    <div>
                                        <p className="text-xs text-zinc-500 mb-1">Status ITL</p>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-3xl font-black ${theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'}`}>{story.summary.itl_score}</span>
                                            <TrendingUp className={`w-4 h-4 ${story.summary.itl_trend === 'up' ? 'text-red-400' : 'text-emerald-400'}`} />
                                        </div>
                                    </div>
                                    <div className={`h-10 w-px ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
                                    <div>
                                        <p className="text-xs text-zinc-500 mb-1">Anomalías</p>
                                        <div className={`flex items-center gap-2 font-bold ${theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'}`}>
                                            <AlertCircle className="w-4 h-4 text-orange-400" />
                                            {story.summary.anomaly_count} Detectadas
                                        </div>
                                    </div>
                                </div>
                            ) : story.image && (
                                <div className="mb-4 w-full h-36 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950">
                                    <img src={story.image} alt="Thumbnail" className="w-full h-full object-cover opacity-80" />
                                </div>
                            )}


                            <div className="space-y-2">
                                <p className="text-xs text-zinc-400 font-medium">Highlights:</p>
                                {story.highlights.map((h: string, i: number) => (
                                    <p key={i} className={`text-sm leading-snug ${theme === 'dark' ? 'text-zinc-200' : 'text-zinc-700'}`}>• {h}</p>
                                ))}
                                {story.highlights.length === 0 && (
                                    <p className="text-sm text-zinc-500 italic">Situación estable sin picos detectados.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Share Buttons */}
                    {(shareEventData || story) && (
                        <div className="grid grid-cols-3 gap-3">
                            <button onClick={copyToClipboard} className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-colors ${theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'}`}>
                                <Copy className={`w-5 h-5 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-600'}`} />
                                <span className="text-[10px] font-medium text-zinc-400">Copiar</span>
                            </button>
                            <a
                                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareEventData ? `Evento: ${shareEventData.descripcion}` : (analysisId ? story.title : 'Briefing de hoy'))}&url=${encodeURIComponent(getShareUrl())}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 transition-colors"
                            >
                                <Twitter className="w-5 h-5 text-sky-400" />
                                <span className="text-[10px] font-medium text-zinc-400">Twitter</span>
                            </a>
                            <a
                                href={`https://wa.me/?text=${encodeURIComponent(shareEventData ? `Evento: ${shareEventData.descripcion} - ${getShareUrl()}` : `Briefing Newsyx - ${story.share_url}`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-colors ${theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'}`}
                            >
                                <MessageCircle className="w-5 h-5 text-emerald-400" />
                                <span className="text-[10px] font-medium text-zinc-400">WhatsApp</span>
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
