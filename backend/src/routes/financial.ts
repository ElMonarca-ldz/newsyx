import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/financial-signals/latest
router.get('/latest', async (req, res) => {
    try {
        // Fetch the most recent signal for each type
        const types = ['dolar_blue', 'riesgo_pais'];

        const latestSignals = await Promise.all(
            types.map(async (type) => {
                return prisma.financialSignal.findFirst({
                    where: { type },
                    orderBy: { createdAt: 'desc' }
                });
            })
        );

        // Filter out nulls and convert to a map for easy frontend usage
        const result = latestSignals.filter(s => s !== null).reduce((acc: any, signal) => {
            acc[signal!.type] = {
                value: signal!.value,
                metadata: signal!.metadata,
                timestamp: signal!.createdAt
            };
            return acc;
        }, {});

        res.json(result);
    } catch (error) {
        console.error('Error fetching financial signals:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
