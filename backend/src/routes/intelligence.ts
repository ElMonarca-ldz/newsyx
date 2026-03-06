import { Router, Request, Response } from 'express';
import { redis } from '../lib/redis';

const router = Router();

router.get('/gaps', async (req: Request, res: Response) => {
    const country = (req.query.country as string) || 'AR';

    try {
        const cachedGaps = await redis.get(`intelligence:gaps:${country}`);

        if (cachedGaps) {
            return res.json(JSON.parse(cachedGaps));
        }

        // If not in redis, return empty for now (wait for celery)
        // Or we could trigger it, but let's stick to the async nature.
        return res.json([]);
    } catch (error: any) {
        console.error('Error fetching intelligence gaps:', error.message);
        res.status(500).json({ error: 'Failed to fetch intelligence gaps' });
    }
});

export default router;
