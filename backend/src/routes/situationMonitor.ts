import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { redis } from '../lib/redis';
import { clusterEvents } from '../lib/clusteringService';

const router = Router();

// GET /api/situation-monitor
// Aggregates temporal_intelligence events across articles for the Situation Monitor
router.get('/', async (req: Request, res: Response) => {
    try {
        const {
            desde,
            hasta,
            scoreDesinMax,
            page,
            limit: limitParam,
        } = req.query;

        const desdeDate = desde
            ? new Date(desde as string)
            : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // default: last 30 days
        const hastaDate = hasta ? new Date(hasta as string) : new Date();
        // If it's a date-only string (YYYY-MM-DD), move to end of day
        if (typeof hasta === 'string' && hasta.length === 10) {
            hastaDate.setHours(23, 59, 59, 999);
        }
        const maxDesin = scoreDesinMax ? parseFloat(scoreDesinMax as string) : 1.0;

        // Fetch articles — filter temporalIntelligence != null in-memory
        // (Prisma doesn't support direct filtering on Json? columns in all versions)
        const rawArticles = await prisma.newsAnalysis.findMany({
            where: {
                status: 'COMPLETED',
                fechaExtraccion: {
                    gte: desdeDate,
                    lte: hastaDate,
                },
                ...(maxDesin < 1.0 ? { scoreDesin: { lte: maxDesin } } : {}),
            },
            select: {
                id: true,
                slug: true,
                titular: true,
                fuente: true,
                url: true,
                fechaPublicacion: true,
                scoreDesin: true,
                scoreCalidad: true,
                analysisData: true,
                geoIntelligence: true,
                temporalIntelligence: true,
                imagenUrl: true,
                categoria: true,
            },
            orderBy: { fechaExtraccion: 'desc' },
            take: 500, // cap for performance
        });

        // Filter to only articles that have temporal_intelligence data
        const articles = rawArticles.filter(a => a.temporalIntelligence != null);

        // Extract and enrich events
        const eventos: any[] = [];
        const lugaresSet = new Set<string>();
        const actoresSet = new Set<string>();
        let alertasCriticas = 0;

        for (const art of articles) {
            const ti = art.temporalIntelligence as any;
            const geo = art.geoIntelligence as any;
            const analysisData = art.analysisData as any;

            if (!ti?.eventos_fechados) continue;

            // Build geo lookup map
            const geoMap = new Map<string, any>();
            if (geo?.lugares_mencionados) {
                for (const lugar of geo.lugares_mencionados) {
                    geoMap.set(lugar.id, lugar);
                    lugaresSet.add(lugar.id);
                }
            }

            // Build actor lookup from analysis data
            const actorMap = new Map<string, any>();
            if (analysisData?.ui_enrichment?.actor_network?.nodos) {
                for (const nodo of analysisData.ui_enrichment.actor_network.nodos) {
                    actorMap.set(nodo.id, nodo);
                }
            }

            // Count critical alerts
            if (analysisData?.riesgo_desinformacion?.alertas) {
                const alertas = analysisData.riesgo_desinformacion.alertas;
                if (Array.isArray(alertas)) {
                    for (const alerta of alertas) {
                        if (typeof alerta === 'object' && (alerta.severidad === 'critical' || alerta.severidad === 'danger')) {
                            alertasCriticas++;
                        }
                    }
                }
            }

            for (const ev of ti.eventos_fechados) {
                // Resolve geo_ref
                const lugarData = ev.geo_ref ? geoMap.get(ev.geo_ref) : null;

                // Resolve actors
                const actoresResueltos = (ev.actores_involucrados || []).map((slug: string) => {
                    const actor = actorMap.get(slug);
                    actoresSet.add(slug);
                    return actor
                        ? {
                            slug: actor.id,
                            label: actor.label,
                            tipo: actor.tipo,
                            sentimiento_hacia: actor.sentimiento_hacia,
                        }
                        : { slug, label: slug, tipo: 'otro', sentimiento_hacia: 'neutral' };
                });

                eventos.push({
                    ...ev,
                    lugar: lugarData
                        ? {
                            slug: lugarData.id,
                            nombre_display: lugarData.nombre_display,
                            lat: lugarData.coordenadas_aproximadas?.lat,
                            lon: lugarData.coordenadas_aproximadas?.lon,
                            ciudad: lugarData.ciudad,
                            provincia: lugarData.provincia,
                            pais: lugarData.pais,
                            tipo: lugarData.tipo,
                            radio_impacto: geo?.radio_impacto || 'local',
                        }
                        : undefined,
                    actores_resueltos: actoresResueltos,
                    articulo: {
                        id: art.id,
                        slug: art.slug,
                        titulo: art.titular,
                        medio: art.fuente,
                        url: art.url,
                        fecha_publicacion: art.fechaPublicacion?.toISOString() || '',
                        scoreDesin: art.scoreDesin || 0,
                        scoreCalidad: art.scoreCalidad || 0,
                        color_dominante: analysisData?.ui_enrichment?.ui_hints?.color_dominante || '#7F8C8D',
                        icono_categoria: analysisData?.ui_enrichment?.ui_hints?.icono_categoria || 'Newspaper',
                        imagen: art.imagenUrl,
                        categoria: art.categoria,
                    },
                    cluster_id: null,
                    peso_relevancia: ev.es_hecho_central ? 0.9 : ev.confianza_fecha || 0.5,
                });
            }
        }

        // Apply clustering
        const clusters = clusterEvents(eventos, {
            geoEpsilonKm: 150,
            timeWindowDays: 14,
            minPoints: 2,
        });

        // Assign cluster_id back to events
        for (const cluster of clusters) {
            for (const ev of cluster.eventos) {
                ev.cluster_id = cluster.id;
                ev.es_convergente = cluster.es_convergente;
            }
        }

        // Get anomalies from Redis
        const anomaliesRaw = await redis.get('intelligence:anomalies:AR');
        const anomalias = anomaliesRaw ? JSON.parse(anomaliesRaw) : [];

        // Stats
        const stats = {
            total_eventos: eventos.length,
            total_lugares: lugaresSet.size,
            total_actores: actoresSet.size,
            alertas_criticas: alertasCriticas,
            anomalias_detectadas: anomalias.length,
            articulos_en_ventana: articles.length,
            ultimo_evento: eventos.length > 0
                ? (eventos[0].fecha_exacta || new Date().toISOString())
                : new Date().toISOString(),
        };

        res.json({
            eventos,
            clusters,
            stats,
            metadata: {
                ventana_desde: desdeDate.toISOString(),
                ventana_hasta: hastaDate.toISOString(),
                generado_en: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('Situation monitor error:', error);
        res.status(500).json({ error: 'Failed to fetch situation monitor data' });
    }
});

router.get('/focal-points', async (req: Request, res: Response) => {
    const country = (req.query.country as string) || 'AR';
    try {
        const cached = await redis.get(`intelligence:focal_points:${country}`);
        if (cached) {
            return res.json(JSON.parse(cached));
        }
        return res.json([]);
    } catch (error: any) {
        console.error('Focal points error:', error.message);
        res.status(500).json({ error: 'Failed to fetch focal points' });
    }
});

export default router;
