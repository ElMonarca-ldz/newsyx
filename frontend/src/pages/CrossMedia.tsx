import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layers, Share2, TrendingUp } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export const CrossMedia = () => {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${API_BASE_URL}/events`)
            .then(res => res.json())
            .then(data => {
                setEvents(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching events:', err);
                setLoading(false);
            });
    }, []);

    if (loading) return <div className="p-8">Cargando eventos cross-media...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Análisis Cross-Media</h2>
                <p className="text-muted-foreground">Historias detectadas en múltiples medios y su evolución narrativa.</p>
            </div>

            {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-xl bg-muted/20">
                    <Layers className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                    <h3 className="text-lg font-medium">No se han detectado eventos compartidos todavía</h3>
                    <p className="text-sm text-muted-foreground mt-1">El sistema agrupa automáticamente las noticias que tratan el mismo tema.</p>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {events.map((event) => (
                        <Card key={event.id} className="overflow-hidden hover:shadow-md transition-shadow">
                            <CardHeader className="bg-muted/30 pb-4">
                                <div className="flex justify-between items-start">
                                    <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase">
                                        Detectado: {new Date(event.createdAt).toLocaleDateString()}
                                    </span>
                                    <div className="flex gap-1 text-muted-foreground">
                                        <Share2 className="w-3.5 h-3.5" />
                                        <span className="text-xs font-semibold">{event._count?.analyses || 0}</span>
                                    </div>
                                </div>
                                <CardTitle className="text-lg mt-2 line-clamp-2">{event.titulo}</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                                    {event.descripcion || 'Sin descripción disponible para este evento.'}
                                </p>
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fuentes Recientes</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {event.analyses?.map((analysis: any) => (
                                            <span key={analysis.id} className="text-[10px] px-2 py-0.5 border rounded-md bg-card">
                                                {analysis.fuente}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <button className="w-full mt-6 text-sm font-semibold text-primary hover:underline flex items-center justify-center gap-2">
                                    <TrendingUp className="w-4 h-4" />
                                    Ver análisis completo
                                </button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};
