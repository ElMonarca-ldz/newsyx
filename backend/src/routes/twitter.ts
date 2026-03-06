import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// ─── GET /api/twitter/profiles ─────────────────────────────────────────
// List all profiles with tweet counts
router.get('/profiles', async (req: Request, res: Response) => {
    try {
        const profiles = await prisma.twitterProfile.findMany({
            orderBy: [{ tier: 'asc' }, { username: 'asc' }],
            include: {
                _count: { select: { tweets: true } },
            },
        });

        // Get pending analysis counts per profile
        const pendingCounts = await prisma.tweet.groupBy({
            by: ['profileId'],
            where: { analysisStatus: 'pending' },
            _count: { id: true },
        });
        const pendingMap = new Map(pendingCounts.map(p => [p.profileId, p._count.id]));

        const enriched = profiles.map(p => ({
            ...p,
            tweetCount: (p as any)._count.tweets,
            pendingAnalysis: pendingMap.get(p.id) || 0,
        }));

        res.json(enriched);
    } catch (error) {
        console.error('Error fetching twitter profiles:', error);
        res.status(500).json({ error: 'Failed to fetch twitter profiles' });
    }
});

// ─── POST /api/twitter/profiles ────────────────────────────────────────
// Create a new monitored profile
router.post('/profiles', async (req: Request, res: Response) => {
    try {
        const {
            username,
            tier,
            category,
            country,
            politicalLean,
            isStateAffiliated,
            scrapeEnabled,
            scrapeInterval,
            scrapeRTs,
            scrapeReplies,
            minTweetLength,
            actorNetworkSlug,
            notes,
        } = req.body;

        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }

        // Normalize username (remove @ if present)
        const cleanUsername = username.replace(/^@/, '').trim();

        const profile = await prisma.twitterProfile.create({
            data: {
                username: cleanUsername,
                tier: tier || 'C',
                category: category || 'analista',
                country: country || 'AR',
                ...(politicalLean !== undefined && { politicalLean }),
                ...(isStateAffiliated !== undefined && { isStateAffiliated }),
                ...(scrapeEnabled !== undefined && { scrapeEnabled }),
                ...(scrapeInterval !== undefined && { scrapeInterval: parseInt(scrapeInterval) }),
                ...(scrapeRTs !== undefined && { scrapeRTs }),
                ...(scrapeReplies !== undefined && { scrapeReplies }),
                ...(minTweetLength !== undefined && { minTweetLength: parseInt(minTweetLength) }),
                ...(actorNetworkSlug !== undefined && { actorNetworkSlug }),
                ...(notes !== undefined && { notes }),
            },
        });

        res.status(201).json(profile);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Profile with this username already exists' });
        }
        console.error('Error creating twitter profile:', error);
        res.status(500).json({ error: 'Failed to create twitter profile' });
    }
});

// ─── PUT /api/twitter/profiles/:id ─────────────────────────────────────
// Full update of a profile
router.put('/profiles/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const {
            username,
            tier,
            category,
            country,
            politicalLean,
            isStateAffiliated,
            scrapeEnabled,
            scrapeInterval,
            scrapeRTs,
            scrapeReplies,
            minTweetLength,
            actorNetworkSlug,
            notes,
            isActive,
        } = req.body;

        const profile = await prisma.twitterProfile.update({
            where: { id },
            data: {
                ...(username !== undefined && { username: username.replace(/^@/, '').trim() }),
                ...(tier !== undefined && { tier }),
                ...(category !== undefined && { category }),
                ...(country !== undefined && { country }),
                ...(politicalLean !== undefined && { politicalLean }),
                ...(isStateAffiliated !== undefined && { isStateAffiliated }),
                ...(scrapeEnabled !== undefined && { scrapeEnabled }),
                ...(scrapeInterval !== undefined && { scrapeInterval: parseInt(scrapeInterval) }),
                ...(scrapeRTs !== undefined && { scrapeRTs }),
                ...(scrapeReplies !== undefined && { scrapeReplies }),
                ...(minTweetLength !== undefined && { minTweetLength: parseInt(minTweetLength) }),
                ...(actorNetworkSlug !== undefined && { actorNetworkSlug }),
                ...(notes !== undefined && { notes }),
                ...(isActive !== undefined && { isActive }),
            },
        });

        res.json(profile);
    } catch (error) {
        console.error('Error updating twitter profile:', error);
        res.status(500).json({ error: 'Failed to update twitter profile' });
    }
});

// ─── PATCH /api/twitter/profiles/:id ───────────────────────────────────
// Toggle scrapeEnabled or isActive
router.patch('/profiles/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { scrapeEnabled, isActive } = req.body;

        const data: any = {};
        if (scrapeEnabled !== undefined) data.scrapeEnabled = scrapeEnabled;
        if (isActive !== undefined) data.isActive = isActive;

        const profile = await prisma.twitterProfile.update({
            where: { id },
            data,
        });

        res.json(profile);
    } catch (error) {
        console.error('Error patching twitter profile:', error);
        res.status(500).json({ error: 'Failed to patch twitter profile' });
    }
});

// ─── DELETE /api/twitter/profiles/:id ──────────────────────────────────
// Delete a profile and all its tweets (cascade)
router.delete('/profiles/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.twitterProfile.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting twitter profile:', error);
        res.status(500).json({ error: 'Failed to delete twitter profile' });
    }
});

// ─── POST /api/twitter/profiles/:id/scrape-now ─────────────────────────
// Force immediate scrape (enqueue Celery task via Redis)
router.post('/profiles/:id/scrape-now', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Verify profile exists
        const profile = await prisma.twitterProfile.findUnique({ where: { id } });
        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        // In production, this would publish to Redis/Celery
        // For now, acknowledge the request
        const { redis } = await import('../lib/redis');
        await redis.publish('twitter:scrape:request', JSON.stringify({
            profile_id: id,
            username: profile.username,
            priority: 0,
            forced: true,
        }));

        res.json({ ok: true, message: `Scrape enqueued for @${profile.username}` });
    } catch (error) {
        console.error('Error triggering scrape:', error);
        res.status(500).json({ error: 'Failed to trigger scrape' });
    }
});

// ─── GET /api/twitter/stats ────────────────────────────────────────────
// Dashboard stats
router.get('/stats', async (req: Request, res: Response) => {
    try {
        const [
            totalProfiles,
            activeProfiles,
            totalTweets,
            pendingAnalysis,
            completedAnalysis,
        ] = await Promise.all([
            prisma.twitterProfile.count(),
            prisma.twitterProfile.count({ where: { scrapeEnabled: true, isActive: true } }),
            prisma.tweet.count(),
            prisma.tweet.count({ where: { analysisStatus: 'pending' } }),
            prisma.tweet.count({ where: { analysisStatus: 'done' } }),
        ]);

        // Tweets in last 24h
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const tweetsLast24h = await prisma.tweet.count({
            where: { scrapedAt: { gte: since24h } },
        });

        // Profiles by tier
        const byTier = await prisma.twitterProfile.groupBy({
            by: ['tier'],
            _count: { id: true },
        });

        res.json({
            totalProfiles,
            activeProfiles,
            totalTweets,
            pendingAnalysis,
            completedAnalysis,
            tweetsLast24h,
            byTier: Object.fromEntries(byTier.map(t => [t.tier, t._count.id])),
        });
    } catch (error) {
        console.error('Error fetching twitter stats:', error);
        res.status(500).json({ error: 'Failed to fetch twitter stats' });
    }
});

// ─── GET /api/twitter/pool-health ──────────────────────────────────────
// Scraper account pool health from Redis cache
router.get('/pool-health', async (req: Request, res: Response) => {
    try {
        const { redis } = await import('../lib/redis');
        const cached = await redis.get('twitter:pool:health');
        if (cached) {
            return res.json(JSON.parse(cached));
        }

        // Fallback: read from DB
        const accounts = await prisma.scraperAccount.findMany({
            orderBy: { username: 'asc' },
        });

        const total = accounts.length;
        const active = accounts.filter(a => a.isActive && a.isLoggedIn).length;

        res.json({
            total,
            active,
            circuit_open: accounts.filter(a => a.circuitOpen).length,
            health_pct: total ? Math.round((active / total) * 100 * 10) / 10 : 0,
            degraded: total ? (active / total) < 0.5 : true,
            accounts: accounts.map(a => ({
                username: a.username,
                active: a.isActive,
                logged_in: a.isLoggedIn,
                total_req: a.totalRequests,
                error: a.errorMsg,
                circuit_open: a.circuitOpen,
            })),
        });
    } catch (error) {
        console.error('Error fetching pool health:', error);
        res.status(500).json({ error: 'Failed to fetch pool health' });
    }
});

// ─── Scraper Accounts Management ──────────────────────────────────────────

// GET /api/twitter/accounts - List accounts (safe for frontend)
router.get('/accounts', async (req: Request, res: Response) => {
    try {
        const accounts = await prisma.scraperAccount.findMany({
            orderBy: { username: 'asc' },
            select: {
                id: true,
                username: true,
                email: true,
                isActive: true,
                isLoggedIn: true,
                lastUsedAt: true,
                totalRequests: true,
                consecutiveFails: true,
                errorMsg: true,
                circuitOpen: true,
                circuitOpenAt: true,
                circuitRetryAt: true,
                tier: true,
                proxyUrl: true,
                createdAt: true,
                updatedAt: true,
            } // explicitly exclude password/cookies in default view
        });
        res.json(accounts);
    } catch (error) {
        console.error('Error fetching scraper accounts:', error);
        res.status(500).json({ error: 'Failed to fetch scraper accounts' });
    }
});

// GET /api/twitter/accounts/internal - Full credentials (for AI engine sync)
router.get('/accounts/internal', async (req: Request, res: Response) => {
    try {
        const accounts = await prisma.scraperAccount.findMany({
            where: { isActive: true },
            orderBy: { username: 'asc' },
        });
        res.json(accounts);
    } catch (error) {
        console.error('Error fetching internal accounts:', error);
        res.status(500).json({ error: 'Failed to fetch internal accounts' });
    }
});

// POST /api/twitter/accounts - Create a new scraper account
router.post('/accounts', async (req: Request, res: Response) => {
    try {
        const { username, password, email, emailPassword, cookies, proxyUrl, tier } = req.body;

        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }

        const account = await prisma.scraperAccount.create({
            data: {
                username: username.replace(/^@/, '').trim(),
                password,
                email,
                emailPassword,
                cookies,
                proxyUrl,
                tier: tier || 'standard',
            },
        });

        // Notify AI Engine
        const { redis } = await import('../lib/redis');
        await redis.publish('twitter:pool:sync', JSON.stringify({ action: 'create', username }));

        res.status(201).json(account);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Account with this username already exists' });
        }
        console.error('Error creating account:', error);
        res.status(500).json({ error: 'Failed to create account' });
    }
});

// PUT /api/twitter/accounts/:id - Update an account
router.put('/accounts/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { username, password, email, emailPassword, cookies, proxyUrl, tier, isActive } = req.body;

        const data: any = {
            ...(username !== undefined && { username: username.replace(/^@/, '').trim() }),
            ...(password !== undefined && { password }),
            ...(email !== undefined && { email }),
            ...(emailPassword !== undefined && { emailPassword }),
            ...(cookies !== undefined && { cookies }),
            ...(proxyUrl !== undefined && { proxyUrl }),
            ...(tier !== undefined && { tier }),
            ...(isActive !== undefined && { isActive }),
        };

        const account = await prisma.scraperAccount.update({
            where: { id },
            data,
        });

        const { redis } = await import('../lib/redis');
        await redis.publish('twitter:pool:sync', JSON.stringify({ action: 'update', username: account.username }));

        res.json(account);
    } catch (error) {
        console.error('Error updating account:', error);
        res.status(500).json({ error: 'Failed to update account' });
    }
});

// DELETE /api/twitter/accounts/:id - Delete an account
router.delete('/accounts/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const account = await prisma.scraperAccount.delete({ where: { id } });

        const { redis } = await import('../lib/redis');
        await redis.publish('twitter:pool:sync', JSON.stringify({ action: 'delete', username: account.username }));

        res.status(204).send();
    } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

export default router;
