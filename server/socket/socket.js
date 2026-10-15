import { Server } from 'socket.io';
import { parse } from 'cookie';
import { authenticateToken } from '../utils/session.js';
import { runtimeConfig } from '../config/runtime.js';
import { objectId } from '../utils/validation.js';
import { idOf, requireConversation, withConversationLock } from '../utils/conversations.js';

export const personalRoom = id => `user:${id}`;
export const conversationRoom = id => `conversation:${id}`;

export const InitializeSocket = (server, config = runtimeConfig()) => {
    const io = new Server(server, {
        cors: { origin: config.clientOrigin, credentials: true },
        allowRequest: (req, done) => done(null, !req.headers.origin ||
            [config.clientOrigin, config.appOrigin].includes(req.headers.origin)),
    });
    io.use(async (socket, next) => {
        try {
            const token = parse(socket.handshake.headers.cookie || '').token;
            const { user, expiresAt } = await authenticateToken(token);
            socket.data.userId = idOf(user);
            // Token stays server-side and is never sent in event payloads.
            socket.sessionToken = token;
            socket.expiresAt = expiresAt;
            next();
        } catch (error) {
            const failure = new Error(error.statusCode === 401 ? 'Authentication failed' : 'Server unavailable');
            failure.data = { code: error.statusCode === 401 ? 'UNAUTHORIZED' : 'SERVER_ERROR' };
            next(failure);
        }
    });
    io.on('connection', async socket => {
        const expire = () => {
            socket.emit('unauthorized', { message: 'Authentication expired' });
            socket.disconnect(true);
        };
        const timer = setTimeout(expire, Math.max(0, socket.expiresAt - Date.now()));
        timer.unref();
        socket.on('disconnect', () => clearTimeout(timer));
        await socket.join(personalRoom(socket.data.userId));
        socket.emit('connected');

        const handle = (event, action) => socket.on(event, async (id, acknowledge) => {
            const respond = result => {
                if (typeof acknowledge === 'function') acknowledge(result);
                else if (!result.success) socket.emit('operation error', result);
            };
            try {
                id = objectId(id, 'conversation ID');
                await authenticateToken(socket.sessionToken);
                await withConversationLock(id, async () => {
                    const conversation = await requireConversation(id, socket.data.userId);
                    if (!socket.connected) return;
                    await action(id, conversation);
                });
                respond({ success: true });
            } catch (error) {
                if (error.statusCode === 401) expire();
                respond({ success: false, status: error.statusCode || 503,
                    message: error.statusCode ? error.message : 'Server unavailable' });
            }
        });
        handle('join chat', id => socket.join(conversationRoom(id)));
        socket.on('leave chat', id => {
            if (typeof id === 'string') socket.leave(conversationRoom(id));
        });
        for (const event of ['typing', 'stop typing']) {
            handle(event, (id, conversation) => {
                for (const participant of conversation.participants) {
                    if (idOf(participant) === socket.data.userId) continue;
                    io.to(personalRoom(idOf(participant))).emit(event, {
                        conversationId: id, userId: socket.data.userId,
                    });
                }
            });
        }
        // There is deliberately no setup/identity or client message relay handler.
    });
    return io;
};
