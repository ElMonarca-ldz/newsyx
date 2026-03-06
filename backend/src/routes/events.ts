import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// Get all events grouped by cross-media coverage
router.get('/', async (req, res) => {
    console.log('GET /api/events');
    try {
        const events = await prisma.newsEvent.findMany({
            include: {
                _count: {
                    select: { analyses: true }
                },
                analyses: {
                    take: 5,
                    orderBy: { fechaExtraccion: 'desc' }
                }
            },
            orderBy: { createdAt: 'desc' },
        });

        // If no events exist, try to group analyses that have the same title or similar keywords
        // (This is a simplified mock for "Cross-Media" if no events are explicitly created by ai-engine)
        if (events.length === 0) {
            // Mock empty state for now or return dummy if needed
        }

        res.json(events);
    } catch (error) {
        console.error('Error in /api/events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// Get single event details
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const event = await prisma.newsEvent.findUnique({
            where: { id },
            include: {
                analyses: {
                    orderBy: { fechaExtraccion: 'desc' }
                }
            }
        });
        if (!event) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }
        res.json(event);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch event detail' });
    }
});

export default router;
