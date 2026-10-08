import express from "express"
import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'
import userRoutes from "./routes/user.route.js"
import messageRoutes from './routes/message.route.js'
import conversationRoutes from './routes/conversation.route.js'
import connectDB from "./utils/db.js"
import cookieParser from 'cookie-parser';
import http from 'http'
import { InitializeSocket } from "./socket/socket.js"

const app = express()
const PORT = process.env.PORT || 3000
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const clientDistPath = path.resolve(__dirname, '../client/dist')

await connectDB();

const server = http.createServer(app);
const io = InitializeSocket(server);

app.use(express.json());
app.use(cookieParser());
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});
app.use('/api/user', userRoutes);
app.use('/api/conversation', conversationRoutes);
app.use('/api/message', messageRoutes);
app.use(express.static(clientDistPath));

app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
        return res.sendFile(path.join(clientDistPath, 'index.html'));
    }

    next();
});

server.listen(
    PORT ,async()=>{
        console.log(`Server is listening on port ${PORT}`)
    }
);
