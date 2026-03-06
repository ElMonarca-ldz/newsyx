import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { PrismaClient } from '@prisma/client';

// Routes
import authRoutes from './routes/auth';
import analysisRoutes from './routes/analysis';
import sourcesRoutes from './routes/sources';
import dashboardRoutes from './routes/dashboard';
import eventsRoutes from './routes/events';
import settingsRoutes from './routes/settings';
import situationMonitorRoutes from './routes/situationMonitor';
import financialRoutes from './routes/financial';
import itlRoutes from './routes/itl';
import streamRoutes from './routes/stream';
import intelligenceRoutes from './routes/intelligence';
import storiesRoutes from './routes/stories';
import twitterRoutes from './routes/twitter';
import actorRoutes from './routes/actors';

import prisma from './lib/prisma';

const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();
const port = process.env.PORT || 4000;
const server = http.createServer(app);

// WebSocket Server for live alerts
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws: any) => {
    console.log('[WS] Client connected to alerts');

    ws.on('message', (message: Buffer) => {
        console.log('[WS] Received message:', message.toString());
    });

    ws.on('close', () => {
        console.log('[WS] Client disconnected');
    });
});

// Upgrade HTTP to WebSocket for /ws/alerts
server.on('upgrade', (request: any, socket: any, head: any) => {
    const { pathname } = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
    console.log(`[WS-DEBUG] Upgrade request for path: ${pathname}`);

    // Clean pathname (remove trailing slash)
    const cleanPath = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

    if (cleanPath === '/ws/alerts') {
        console.log('[WS-DEBUG] Path matched /ws/alerts, upgrading...');
        wss.handleUpgrade(request, socket, head, (ws: any) => {
            console.log('[WS-DEBUG] Upgrade completed, emitting connection');
            wss.emit('connection', ws, request);
        });
    } else {
        console.log(`[WS-DEBUG] Path mismatch: expected /ws/alerts, got ${cleanPath}. Destroying socket.`);
        socket.destroy();
    }
});

app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/sources', sourcesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/situation-monitor', situationMonitorRoutes);
app.use('/api/financial-signals', financialRoutes);
app.use('/api/itl', itlRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/stories', storiesRoutes);
app.use('/api/twitter', twitterRoutes);
app.use('/api/actors', actorRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

server.listen(port, () => {
    console.log(`Backend API listening at http://localhost:${port}`);
    console.log(`WebSocket server active at ws://localhost:${port}/ws/alerts`);
});

export { app, wss };
