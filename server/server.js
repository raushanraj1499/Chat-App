import 'dotenv/config';
import http from 'node:http';
import { createApp } from './app.js';
import { validateEnvironment } from './config/runtime.js';
import connectDB from './utils/db.js';
import { InitializeSocket } from './socket/socket.js';

try {
    const config = validateEnvironment();
    await connectDB();
    const app = createApp(config);
    const server = http.createServer(app);
    app.set('io', InitializeSocket(server, config));
    server.on('error', () => {
        console.error('HTTP server failed to start');
        process.exit(1);
    });
    server.listen(config.port, () => console.log(`Server is listening on port ${config.port}`));
} catch (error) {
    // Configuration and wrapped database messages are safe to print; raw driver
    // errors can contain connection details and remain hidden.
    const safeMessage = /^(Missing required configuration:|Invalid |Production origins |SameSite=None |MongoDB connection failed\.)/.test(error.message)
        ? error.message
        : 'Startup failed. Check configuration and database availability.';
    console.error(safeMessage);
    process.exit(1);
}
