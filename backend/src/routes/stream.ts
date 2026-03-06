import { Router, Request, Response } from 'express';
import axios from 'axios';
import { authenticate } from '../middleware/auth';

const router = Router();

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8000';

router.get('/:id/stream', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { url } = req.query;

    if (!url) {
        res.status(400).json({ error: 'URL is required' });
        return;
    }

    console.log(`Starting SSE stream for article ${id}: ${url}`);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
        const response = await axios({
            method: 'get',
            url: `${AI_ENGINE_URL}/analyze/stream`,
            params: { url },
            responseType: 'stream',
        });

        response.data.on('data', (chunk: any) => {
            res.write(chunk);
        });

        response.data.on('end', () => {
            res.end();
        });

        req.on('close', () => {
            console.log(`Client closed connection for ${id}`);
            response.data.destroy();
        });

    } catch (error: any) {
        console.error('SSE Proxy Error:', error.message);
        res.write(`data: ${JSON.stringify({ error: 'Failed to connect to AI Engine' })}\n\n`);
        res.end();
    }
});

export default router;
