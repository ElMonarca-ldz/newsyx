import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/itl/current?country=AR
router.get('/current', async (req, res) => {
    try {
        const country = (req.query.country as string) || 'AR';

        const latestScore = await prisma.countryScore.findFirst({
            where: { country },
            orderBy: { createdAt: 'desc' }
        });

        if (!latestScore) {
            return res.status(404).json({ error: 'No score found for this country' });
        }

        res.json({
            score: latestScore.score,
            trend: latestScore.trend,
            components: latestScore.components,
            topDrivers: latestScore.topDrivers,
            timestamp: latestScore.createdAt
        });
    } catch (error) {
        console.error('Error fetching ITL score:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/itl/history?country=AR&limit=24
router.get('/history', async (req, res) => {
    try {
        const country = (req.query.country as string) || 'AR';
        const limit = parseInt(req.query.limit as string) || 24;

        const history = await prisma.countryScore.findMany({
            where: { country },
            orderBy: { createdAt: 'desc' },
            take: limit
        });

        res.json(history.reverse());
    } catch (error) {
        console.error('Error fetching ITL history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
