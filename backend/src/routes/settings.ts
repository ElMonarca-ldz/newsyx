import { Router } from 'express';
import prisma from '../lib/prisma';
import { DEFAULT_ANALYSIS_PROMPT, DEFAULT_CROSSMEDIA_PROMPT } from './default_prompts';

import axios from 'axios';

const router = Router();

// Get settings for the platform
router.get('/', async (req, res) => {
    console.log('GET /api/settings');

    // Get database configs
    const dbConfigs = await prisma.systemConfig.findMany();
    const configMap = dbConfigs.reduce((acc: any, curr) => {
        acc[curr.key] = curr.value;
        return acc;
    }, {});

    const settings = {
        general: {
            app_url: process.env.APP_URL || 'http://localhost:3000',
            port: process.env.PORT || 4000,
        },
        pipeline: {
            ingestion_cycle_minutes: configMap['INGESTION_CYCLE_MINUTES'] || process.env.INGESTION_CYCLE_MINUTES || '15',
            max_articles_per_cycle: configMap['MAX_ARTICLES_PER_CYCLE'] || process.env.MAX_ARTICLES_PER_CYCLE || '200',
            analysis_timeout_seconds: process.env.ANALYSIS_TIMEOUT_SECONDS || '120',
            llm_router_active: true,
            primary_model: configMap['GOOGLE_MODEL'] || process.env.GOOGLE_MODEL || 'gemini-1.5-flash',
            openrouter_api_key: configMap['OPENROUTER_API_KEY'] ? '********' : null,
            openrouter_model: configMap['OPENROUTER_MODEL'] || process.env.OPENROUTER_MODEL || 'google/gemini-flash-2.5',
            google_api_key: configMap['GOOGLE_API_KEY'] ? '********' : null,
            google_model: configMap['GOOGLE_MODEL'] || process.env.GOOGLE_MODEL || 'gemini-1.5-flash',
            groq_api_key: configMap['GROQ_API_KEY'] ? '********' : null,
            groq_model: configMap['GROQ_MODEL'] || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
            gpt4free_model: configMap['GPT4FREE_MODEL'] || process.env.GPT4FREE_MODEL || 'gpt-4o',
            global_ingestion_enabled: configMap['GLOBAL_INGESTION_ENABLED'] !== 'false', // Default true
        },
        features: {
            crossmedia_search: process.env.ENABLE_CROSSMEDIA_SEARCH === 'true',
            wayback_check: process.env.ENABLE_WAYBACK_CHECK === 'true',
            gnews_enabled: process.env.ENABLE_GNEWS === 'true',
            newsapi_enabled: process.env.ENABLE_NEWSAPI === 'true',
            mediastack_enabled: process.env.ENABLE_MEDIASTACK === 'true',
            direct_scrape_enabled: process.env.ENABLE_DIRECT_SCRAPE === 'true',
        },
        database: {
            connected: true,
        },
    };
    res.json(settings);
});

// Toggle global ingestion state
router.post('/ingestion/toggle', async (req, res) => {
    console.log('POST /api/settings/ingestion/toggle', req.body);
    const { enabled } = req.body;

    try {
        await prisma.systemConfig.upsert({
            where: { key: 'GLOBAL_INGESTION_ENABLED' },
            update: { value: enabled ? 'true' : 'false' },
            create: { key: 'GLOBAL_INGESTION_ENABLED', value: enabled ? 'true' : 'false' }
        });
        res.json({ message: 'Global ingestion state updated', enabled });
    } catch (error) {
        console.error('Error toggling global ingestion:', error);
        res.status(500).json({ error: 'Failed to update ingestion state' });
    }
});

// Get available models from OpenRouter
router.get('/openrouter/models', async (req, res) => {
    try {
        const apiKeyEntry = await prisma.systemConfig.findUnique({ where: { key: 'OPENROUTER_API_KEY' } });
        const apiKey = apiKeyEntry?.value || process.env.OPENROUTER_API_KEY;

        if (!apiKey) {
            return res.status(400).json({ error: 'OpenRouter API Key not configured' });
        }

        const response = await axios.get('https://openrouter.ai/api/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        const models = response.data.data
            .map((m: any) => ({
                id: m.id,
                name: m.name,
                context_length: m.context_length,
                pricing: m.pricing
            }))
            .sort((a: any, b: any) => a.name.localeCompare(b.name));

        res.json(models);
    } catch (error: any) {
        console.error('Error fetching OpenRouter models:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch models from OpenRouter' });
    }
});

// Update LLM configuration
router.post('/llm/config', async (req, res) => {
    console.log('POST /api/settings/llm/config', req.body);
    const {
        openrouterApiKey, openrouterModel,
        googleApiKey, googleModel,
        groqApiKey, groqModel,
        gpt4freeModel
    } = req.body;

    try {
        const updates = [];

        // OpenRouter
        if (openrouterApiKey) updates.push(prisma.systemConfig.upsert({ where: { key: 'OPENROUTER_API_KEY' }, update: { value: openrouterApiKey }, create: { key: 'OPENROUTER_API_KEY', value: openrouterApiKey } }));
        if (openrouterModel) updates.push(prisma.systemConfig.upsert({ where: { key: 'OPENROUTER_MODEL' }, update: { value: openrouterModel }, create: { key: 'OPENROUTER_MODEL', value: openrouterModel } }));

        // Google
        if (googleApiKey) updates.push(prisma.systemConfig.upsert({ where: { key: 'GOOGLE_API_KEY' }, update: { value: googleApiKey }, create: { key: 'GOOGLE_API_KEY', value: googleApiKey } }));
        if (googleModel) updates.push(prisma.systemConfig.upsert({ where: { key: 'GOOGLE_MODEL' }, update: { value: googleModel }, create: { key: 'GOOGLE_MODEL', value: googleModel } }));

        // Groq
        if (groqApiKey) updates.push(prisma.systemConfig.upsert({ where: { key: 'GROQ_API_KEY' }, update: { value: groqApiKey }, create: { key: 'GROQ_API_KEY', value: groqApiKey } }));
        if (groqModel) updates.push(prisma.systemConfig.upsert({ where: { key: 'GROQ_MODEL' }, update: { value: groqModel }, create: { key: 'GROQ_MODEL', value: groqModel } }));

        // GPT4Free
        if (gpt4freeModel) updates.push(prisma.systemConfig.upsert({ where: { key: 'GPT4FREE_MODEL' }, update: { value: gpt4freeModel }, create: { key: 'GPT4FREE_MODEL', value: gpt4freeModel } }));

        await Promise.all(updates);
        res.json({ message: 'Configuration updated successfully' });
    } catch (error) {
        console.error('Error updating LLM config:', error);
        res.status(500).json({ error: 'Failed to update configuration' });
    }
});

// Update Pipeline configuration (Ingestion Cycle & Max Articles)
router.post('/pipeline/config', async (req, res) => {
    console.log('POST /api/settings/pipeline/config', req.body);
    const { ingestionCycleMinutes, maxArticlesPerCycle } = req.body;

    try {
        const updates = [];

        if (ingestionCycleMinutes !== undefined) {
            updates.push(prisma.systemConfig.upsert({
                where: { key: 'INGESTION_CYCLE_MINUTES' },
                update: { value: String(ingestionCycleMinutes) },
                create: { key: 'INGESTION_CYCLE_MINUTES', value: String(ingestionCycleMinutes) }
            }));
        }

        if (maxArticlesPerCycle !== undefined) {
            updates.push(prisma.systemConfig.upsert({
                where: { key: 'MAX_ARTICLES_PER_CYCLE' },
                update: { value: String(maxArticlesPerCycle) },
                create: { key: 'MAX_ARTICLES_PER_CYCLE', value: String(maxArticlesPerCycle) }
            }));
        }

        await Promise.all(updates);
        res.json({ message: 'Pipeline configuration updated successfully' });
    } catch (error) {
        console.error('Error updating pipeline config:', error);
        res.status(500).json({ error: 'Failed to update pipeline configuration' });
    }
});

// Test LLM connectivity
router.post('/llm/test', async (req, res) => {
    const { provider, apiKey } = req.body;
    console.log(`POST /api/settings/llm/test - provider: ${provider}`);

    let actualKey: string;
    if (!apiKey || apiKey === '********') {
        // If testing existing masked key, we need to fetch it
        const keyMap: any = {
            'google': 'GOOGLE_API_KEY',
            'groq': 'GROQ_API_KEY',
            'openrouter': 'OPENROUTER_API_KEY'
        };
        const entry = await prisma.systemConfig.findUnique({ where: { key: keyMap[provider] } });
        if (!entry || !entry.value) {
            return res.status(400).json({ success: false, error: 'API Key no configurada' });
        }
        actualKey = entry.value;
    } else {
        actualKey = apiKey;
    }

    try {
        if (provider === 'google') {
            const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${actualKey}`);
            return res.json({ success: true, message: 'Conexión con Google Gemini exitosa' });
        }

        if (provider === 'groq') {
            const response = await axios.get('https://api.groq.com/openai/v1/models', {
                headers: { 'Authorization': `Bearer ${actualKey}` }
            });
            return res.json({ success: true, message: 'Conexión con Groq exitosa' });
        }

        if (provider === 'openrouter') {
            const response = await axios.get('https://openrouter.ai/api/v1/models', {
                headers: { 'Authorization': `Bearer ${actualKey}` }
            });
            return res.json({ success: true, message: 'Conexión con OpenRouter exitosa' });
        }

        if (provider === 'gpt4free') {
            // GPT4Free doesn't have a simple health API we can call easily from Node without the library
            // We just return success as "Configurado" if the model is set
            return res.json({ success: true, message: 'GPT4Free configurado (validación local)' });
        }

        return res.status(400).json({ success: false, error: 'Proveedor no soportado' });
    } catch (error: any) {
        console.error(`Error testing ${provider}:`, error.response?.data || error.message);
        const detail = error.response?.data?.error?.message || error.message;
        return res.status(500).json({ success: false, error: `Error de conexión: ${detail}` });
    }
});

// Deprecated endpoint for backward compatibility (could be kept or redirected)
router.post('/openrouter/config', async (req, res) => {
    console.log('POST /api/settings/openrouter/config', req.body);
    const { apiKey, model } = req.body;
    try {
        const updates = [];
        if (apiKey) updates.push(prisma.systemConfig.upsert({ where: { key: 'OPENROUTER_API_KEY' }, update: { value: apiKey }, create: { key: 'OPENROUTER_API_KEY', value: apiKey } }));
        if (model) updates.push(prisma.systemConfig.upsert({ where: { key: 'OPENROUTER_MODEL' }, update: { value: model }, create: { key: 'OPENROUTER_MODEL', value: model } }));
        await Promise.all(updates);
        res.json({ message: 'Configuration updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update configuration' });
    }
});

// Get custom prompts
router.get('/prompts', async (req, res) => {
    try {
        const dbConfigs = await prisma.systemConfig.findMany({
            where: {
                key: {
                    in: ['PROMPT_ANALYSIS', 'PROMPT_CROSSMEDIA']
                }
            }
        });

        const configMap = dbConfigs.reduce((acc: any, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});

        res.json({
            analysisPrompt: configMap['PROMPT_ANALYSIS'] || DEFAULT_ANALYSIS_PROMPT,
            crossmediaPrompt: configMap['PROMPT_CROSSMEDIA'] || DEFAULT_CROSSMEDIA_PROMPT
        });
    } catch (error) {
        console.error('Error fetching prompts:', error);
        res.status(500).json({ error: 'Failed to fetch prompts' });
    }
});

// Update custom prompts
router.post('/prompts', async (req, res) => {
    console.log('POST /api/settings/prompts', req.body);
    const { analysisPrompt, crossmediaPrompt } = req.body;

    try {
        const updates = [];
        if (analysisPrompt !== undefined) {
            updates.push(prisma.systemConfig.upsert({
                where: { key: 'PROMPT_ANALYSIS' },
                update: { value: analysisPrompt },
                create: { key: 'PROMPT_ANALYSIS', value: analysisPrompt }
            }));
        }
        if (crossmediaPrompt !== undefined) {
            updates.push(prisma.systemConfig.upsert({
                where: { key: 'PROMPT_CROSSMEDIA' },
                update: { value: crossmediaPrompt },
                create: { key: 'PROMPT_CROSSMEDIA', value: crossmediaPrompt }
            }));
        }

        await Promise.all(updates);
        res.json({ message: 'Prompts updated successfully' });
    } catch (error) {
        console.error('Error updating prompts:', error);
        res.status(500).json({ error: 'Failed to update prompts' });
    }
});

// Get LLM Logs (last 30)
router.get('/llm/logs', async (req, res) => {
    try {
        // Use the model name as generated by Prisma (usually lLMLog for LLMLog model)
        const logs = await (prisma as any).lLMLog.findMany({
            take: 30,
            orderBy: { createdAt: 'desc' }
        });
        res.json(logs);
    } catch (error) {
        console.error('Error fetching LLM logs:', error);
        res.status(500).json({ error: 'Failed to fetch LLM logs' });
    }
});

export default router;

