import { Router, Request, Response } from 'express';
import { redis } from '../lib/redis';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
    try {
        const country = (req.query.country as string) || 'AR';

        // Fetch current ITL score
        const itlRaw = await redis.get(`itl:current:${country}`);
        const itl = itlRaw ? JSON.parse(itlRaw) : null;

        // Fetch anomalies
        const anomaliesRaw = await redis.get(`intelligence:anomalies:${country}`);
        const anomalies = (anomaliesRaw ? JSON.parse(anomaliesRaw) : []) as any[];

        // Fetch top focal points
        const focalPointsRaw = await redis.get(`intelligence:focal_points:${country}`);
        const focalPoints = (focalPointsRaw ? JSON.parse(focalPointsRaw) : []) as any[];

        // Build a "Intelligence Briefing" story
        const story = {
            id: `story-${Date.now()}`,
            timestamp: new Date().toISOString(),
            country,
            summary: {
                itl_score: itl?.score || 50,
                itl_trend: itl?.trend || 'stable',
                anomaly_count: anomalies.length,
                top_actor: focalPoints.find(f => f.type === 'actor')?.name || 'N/A',
                top_location: focalPoints.find(f => f.type === 'location')?.name || 'N/A',
            },
            highlights: anomalies.slice(0, 2).map(a => a.message),
            share_url: `${process.env.VITE_APP_URL || 'http://localhost:3000'}/briefing/${country}`
        };

        res.json(story);
    } catch (error) {
        console.error('Story generation error:', error);
        res.status(500).json({ error: 'Failed to generate story' });
    }
});

// GET /api/stories/analysis/:idOrSlug
// Generates a shareable brief for a specific news analysis
router.get('/analysis/:idOrSlug(*)', async (req: Request, res: Response) => {
    const { idOrSlug } = req.params;
    try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

        const analysis = await prisma.newsAnalysis.findUnique({
            where: isUuid ? { id: idOrSlug } : { slug: idOrSlug },
            select: {
                id: true,
                slug: true,
                titular: true,
                fuente: true,
                scoreGlobal: true,
                analysisData: true,
                fechaPublicacion: true,
                imagenUrl: true

            }
        });

        if (!analysis) {
            res.status(404).json({ error: 'Analysis not found' });
            return;
        }

        const data = analysis.analysisData as any;
        const executiveSummary = data?.resumen_ejecutivo || 'Sin resumen disponible.';

        const story = {
            id: analysis.id,
            timestamp: analysis.fechaPublicacion || new Date().toISOString(),
            title: analysis.titular,
            source: analysis.fuente,
            summary: {
                itl_score: Math.round((analysis.scoreGlobal || 0.5) * 100),
                itl_trend: 'stable',
                anomaly_count: data?.riesgo_desinformacion?.alertas?.length || 0
            },
            image: analysis.imagenUrl,
            highlights: [executiveSummary.slice(0, 200) + (executiveSummary.length > 200 ? '...' : '')],
            share_url: `${process.env.VITE_APP_URL || 'http://localhost:3000'}/explorar/${analysis.slug || analysis.id}`
        };

        res.json(story);
    } catch (error) {
        console.error('Story analysis generation error:', error);
        res.status(500).json({ error: 'Failed to generate article story' });
    }
});

export default router;
