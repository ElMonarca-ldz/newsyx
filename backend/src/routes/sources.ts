import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import axios from 'axios';
import * as cheerio from 'cheerio';

const router = Router();

router.get('/', async (req, res) => {
    console.log('GET /api/sources');
    try {
        const sources = await prisma.rssFeed.findMany({
            orderBy: { nombre: 'asc' },
        });
        res.json(sources);
    } catch (error) {
        console.error('Error in /api/sources:', error);
        res.status(500).json({ error: 'Failed to fetch sources' });
    }
});

// Endpoint used to scrape a URL and identify RSS feeds
router.post('/discover', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        // Normalize URL
        let targetUrl = url;
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            targetUrl = 'https://' + targetUrl;
        }

        const response = await axios.get(targetUrl, {
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });

        const $ = cheerio.load(response.data);
        const feeds: Array<{ title: string, url: string, type: string }> = [];

        $('link[type="application/rss+xml"]').each((i: any, link: any) => {
            const href = $(link).attr('href');
            let absoluteUrl = href;
            if (href && !href.startsWith('http')) {
                const baseUrl = new URL(targetUrl).origin;
                absoluteUrl = new URL(href, baseUrl).href;
            }
            if (absoluteUrl) {
                feeds.push({
                    title: $(link).attr('title') || 'Feed RSS General',
                    url: absoluteUrl,
                    type: 'rss'
                });
            }
        });

        // Add atom or json feeds as fallback if RSS isn't found
        $('link[type="application/atom+xml"]').each((i: any, link: any) => {
            const href = $(link).attr('href');
            let absoluteUrl = href;
            if (href && !href.startsWith('http')) {
                const baseUrl = new URL(targetUrl).origin;
                absoluteUrl = new URL(href, baseUrl).href;
            }
            if (absoluteUrl) {
                feeds.push({
                    title: $(link).attr('title') || 'Feed Atom General',
                    url: absoluteUrl,
                    type: 'atom'
                });
            }
        });

        res.json({ targetUrl, feeds });
    } catch (error: any) {
        console.error('Error discovering feeds:', error.message);
        res.status(500).json({ error: 'Failed to discover feeds. URL might be unreachable or blocks scraping.' });
    }
});

// Endpoint to generate a Google News topic feed
router.post('/generate-topic', async (req, res) => {
    try {
        const { topic, country_hl, is_topic_code } = req.body;
        // is_topic_code handles Google News precise topic codes (like HEADLINES, TECHNOLOGY), otherwise custom query
        if (!topic) return res.status(400).json({ error: 'Topic or keyword is required' });

        const [lang, country] = (country_hl || 'es-ES').split('-');
        let rssUrl = '';

        if (is_topic_code) {
            rssUrl = `https://news.google.com/news/rss/headlines/section/topic/${encodeURIComponent(topic.toUpperCase())}?hl=${lang}&gl=${country}`;
        } else {
            rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=${lang}&gl=${country}`;
        }

        res.json({
            title: `GN: ${topic}`,
            url: rssUrl,
            type: 'google_news_topic'
        });
    } catch (error: any) {
        console.error('Error generating GN feed:', error.message);
        res.status(500).json({ error: 'Failed to generate topic feed' });
    }
});

router.post('/', async (req, res) => {
    try {
        const {
            feedId, url, nombre, dominio, pais, idioma, categoria,
            // A1 · Tier fields
            tier, propagandaRisk, stateAffiliated, politicalLean,
            countryOrigin, reachScope,
        } = req.body;
        const newSource = await prisma.rssFeed.create({
            data: {
                feedId,
                url,
                nombre,
                dominio,
                pais: pais || 'AR',
                idioma: idioma || 'es',
                categoria: categoria || 'General',
                // A1 · Tier fields (defaults defined in schema)
                ...(tier !== undefined && { tier }),
                ...(propagandaRisk !== undefined && { propagandaRisk }),
                ...(stateAffiliated !== undefined && { stateAffiliated }),
                ...(politicalLean !== undefined && { politicalLean }),
                ...(countryOrigin !== undefined && { countryOrigin }),
                ...(reachScope !== undefined && { reachScope }),
            }
        });
        res.status(201).json(newSource);
    } catch (error) {
        console.error('Error creating source:', error);
        res.status(500).json({ error: 'Failed to create source' });
    }
});

router.patch('/:id', async (req, res) => {
    console.log('PATCH /api/sources/' + req.params.id, req.body);
    try {
        const { id } = req.params;
        const { activo } = req.body;
        const updatedSource = await prisma.rssFeed.update({
            where: { id },
            data: { activo }
        });
        res.json(updatedSource);
    } catch (error) {
        console.error('Error updating source:', error);
        res.status(500).json({ error: 'Failed to update source' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            feedId, url, nombre, dominio, pais, idioma, categoria,
            // A1 · Tier fields
            tier, propagandaRisk, stateAffiliated, politicalLean,
            countryOrigin, reachScope,
        } = req.body;
        const updatedSource = await prisma.rssFeed.update({
            where: { id },
            data: {
                feedId,
                url,
                nombre,
                dominio,
                pais,
                idioma,
                categoria,
                // A1 · Tier fields
                ...(tier !== undefined && { tier }),
                ...(propagandaRisk !== undefined && { propagandaRisk }),
                ...(stateAffiliated !== undefined && { stateAffiliated }),
                ...(politicalLean !== undefined && { politicalLean }),
                ...(countryOrigin !== undefined && { countryOrigin }),
                ...(reachScope !== undefined && { reachScope }),
            }
        });
        res.json(updatedSource);
    } catch (error) {
        console.error('Error updating source:', error);
        res.status(500).json({ error: 'Failed to update source' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.rssFeed.delete({
            where: { id }
        });
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting source:', error);
        res.status(500).json({ error: 'Failed to delete source' });
    }
});

export default router;
