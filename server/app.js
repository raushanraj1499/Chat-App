import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import userRoutes from './routes/user.route.js';
import messageRoutes from './routes/message.route.js';
import conversationRoutes from './routes/conversation.route.js';
import { runtimeConfig } from './config/runtime.js';
import { errorHandler } from './middleware/errors.js';

export function createApp(config = runtimeConfig()) {
    const app = express();
    app.disable('x-powered-by');
    // Configure a known proxy hop count only when deployment requires it.
    if (process.env.TRUST_PROXY) {
        const hops = Number(process.env.TRUST_PROXY);
        if (!Number.isInteger(hops) || hops < 1) throw new Error('TRUST_PROXY must be a positive hop count');
        app.set('trust proxy', hops);
    }
    app.use(cors({ origin: config.clientOrigin, credentials: true }));
    app.use(express.json({ limit: '64kb' }));
    app.use(cookieParser());
    app.use((req, res, next) => {
        if (req.body !== undefined && (!req.body || Array.isArray(req.body) || typeof req.body !== 'object')) {
            return res.status(400).json({ success: false, message: 'Request body must be an object' });
        }
        next();
    });
    app.get('/health', (req, res) => res.json({ status: 'ok' }));
    app.use('/api/user', userRoutes);
    app.use('/api/conversation', conversationRoutes);
    app.use('/api/message', messageRoutes);
    app.use('/api', (req, res) => res.status(404).json({ success: false, message: 'API route not found' }));
    const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client/dist');
    app.use(express.static(dist));
    app.use((req, res, next) => {
        if (req.method === 'GET') return res.sendFile(path.join(dist, 'index.html'));
        next();
    });
    app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
    app.use(errorHandler);
    return app;
}
