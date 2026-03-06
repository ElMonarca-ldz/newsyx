import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/stats', async (req: Request, res: Response) => {
    console.log('GET /api/dashboard/stats');
    try {
        const totalAnalyses = await prisma.newsAnalysis.count();
        const completedAnalyses = await prisma.newsAnalysis.count({
            where: { status: 'COMPLETED' }
        });
        const pendingAnalyses = await prisma.newsAnalysis.count({
            where: { status: 'PENDING' }
        });
        const failedAnalyses = await prisma.newsAnalysis.count({
            where: { status: 'FAILED' }
        });

        res.json({
            total: totalAnalyses,
            completed: completedAnalyses,
            pending: pendingAnalyses,
            failed: failedAnalyses,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error in /api/dashboard/stats:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
});

export default router;
