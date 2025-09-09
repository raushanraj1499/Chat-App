import express from "express"
import 'dotenv/config'
import userRoutes from "./routes/user.route.js"
import messageRoutes from './routes/message.route.js'
import conversationRoutes from './routes/conversation.route.js'
import connectDB from "./utils/db.js"
import cors from 'cors'
import cookieParser from 'cookie-parser';
import http from 'http'
import { InitializeSocket } from "./socket/socket.js"

const app = express()
const PORT = process.env.PORT

await connectDB();

const server = http.createServer(app);
const io = InitializeSocket(server);

app.use(express.json());
app.use(cookieParser());
app.use(cors());
app.use('/api/user', userRoutes);
app.use('/api/conversation', conversationRoutes);
app.use('/api/message', messageRoutes);

server.listen(
    PORT ,async()=>{
        console.log(`Server is listening on port ${PORT}`)
    }
);  


