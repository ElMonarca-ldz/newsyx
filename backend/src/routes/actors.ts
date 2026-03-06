import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/actors/:slug/timeline
// Fetches all news articles involving a specific actor slug, ordered chronologically
router.get('/:slug/timeline', async (req: Request, res: Response) => {
    const { slug } = req.params;

    try {
        // We use raw SQL because querying inside deep JSONB structures 
        // across many records is more reliable/efficient with Postgres operators.
        // We look for the slug in actors_involucrados within temporal_intelligence->eventos_fechados
        // OR in ui_enrichment->actor_network->nodos

        const analyses = await prisma.$queryRaw`
            SELECT 
                id, 
                slug, 
                titular as "titular", 
                fuente as "fuente", 
                url, 
                fecha_publicacion as "fechaPublicacion", 
                fecha_extraccion as "fechaExtraccion",
                score_desinformacion as "scoreDesin",
                score_calidad as "scoreCalidad",
                analysis_data as "analysisData",
                geo_intelligence as "geoIntelligence",
                temporal_intelligence as "temporalIntelligence",
                imagen_url as "imagenUrl",
                categoria,
                event_id as "eventId"
            FROM news_analysis
            WHERE status = 'COMPLETED'
            AND (
                analysis_data->'ui_enrichment'->'actor_network'->'nodos' @> jsonb_build_array(jsonb_build_object('id', ${slug}))
                OR 
                EXISTS (
                    SELECT 1 
                    FROM jsonb_array_elements(temporal_intelligence->'eventos_fechados') as ev
                    WHERE ev->'actores_involucrados' @> jsonb_build_array(${slug})
                )
            )
            ORDER BY fecha_publicacion DESC, fecha_extraccion DESC
            LIMIT 100
        `;

        // Enrich with event data if available
        const enrichedAnalyses = await Promise.all((analyses as any[]).map(async (art) => {
            let event = null;
            if (art.eventId) {
                event = await prisma.newsEvent.findUnique({
                    where: { id: art.eventId },
                    select: { titulo: true, id: true }
                });
            }

            // Filter eventos_fechados to only those involving the actor
            const ti = art.temporalIntelligence;
            const relevantEvents = ti?.eventos_fechados
                ? ti.eventos_fechados.filter((ev: any) =>
                    ev.actores_involucrados?.includes(slug)
                )
                : [];

            return {
                ...art,
                event,
                relevantEvents
            };
        }));

        res.json(enrichedAnalyses);
    } catch (error) {
        console.error(`Error fetching timeline for actor ${slug}:`, error);
        res.status(500).json({ error: 'Failed to fetch actor timeline' });
    }
});

export default router;
