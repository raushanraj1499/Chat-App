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
    // Do not print driver errors or connection strings containing credentials.
    console.error(error.message.startsWith('Missing required configuration:') ? error.message : 'Startup failed. Check configuration and database availability.');
    process.exit(1);
}
