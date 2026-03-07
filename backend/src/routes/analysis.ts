import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();

// Get all analyses with pagination and filters
router.get('/', async (req: Request, res: Response) => {
    console.log('GET /api/analysis', req.query);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const { fuente, search, startDate, endDate, status, categoria } = req.query;

    const where: any = {};

    if (fuente) {
        where.fuente = { contains: fuente as string, mode: 'insensitive' };
    }

    if (search) {
        where.titular = { contains: search as string, mode: 'insensitive' };
    }

    if (status) {
        where.status = status as string;
    }

    if (categoria) {
        where.categoria = categoria as string;
    }

    if (startDate || endDate) {
        where.fechaExtraccion = {};
        if (startDate) where.fechaExtraccion.gte = new Date(startDate as string);
        if (endDate) where.fechaExtraccion.lte = new Date(endDate as string);
    }

    try {
        const [total, data] = await prisma.$transaction([
            prisma.newsAnalysis.count({ where }),
            prisma.newsAnalysis.findMany({
                where,
                skip,
                take: limit,
                orderBy: { fechaExtraccion: 'desc' },
            }),
        ]);

        res.json({
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Filter error:', error);
        res.status(500).json({ error: 'Failed to fetch analyses' });
    }
});

// Get single analysis by ID
router.get('/:idOrSlug(*)', async (req: Request, res: Response) => {
    const { idOrSlug } = req.params;
    try {
        // Try UUID first (default Prisma behavior for findUnique if it looks like one)
        let analysis = null;

        // Regex for UUID
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

        if (isUuid) {
            analysis = await prisma.newsAnalysis.findUnique({ where: { id: idOrSlug } });
        } else {
            // Try slug
            analysis = await prisma.newsAnalysis.findUnique({ where: { slug: idOrSlug } });
        }

        if (!analysis) {
            res.status(404).json({ error: 'Analysis not found' });
            return;
        }
        res.json(analysis);
    } catch (error) {
        console.error('Fetch analysis error:', error);
        res.status(500).json({ error: 'Failed to fetch analysis' });
    }
});

// Delete analysis by ID
router.delete('/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        await prisma.newsAnalysis.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Failed to delete analysis' });
    }
});

// Bulk delete analyses
router.post('/bulk-delete', async (req: Request, res: Response) => {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: 'Invalid or empty IDs array' });
        return;
    }

    try {
        const result = await prisma.newsAnalysis.deleteMany({
            where: {
                id: { in: ids }
            }
        });
        res.status(200).json({
            message: `Successfully deleted ${result.count} analyses`,
            count: result.count
        });
    } catch (error) {
        console.error('Bulk delete error:', error);
        res.status(500).json({ error: 'Failed to perform bulk deletion' });
    }
});

export default router;
