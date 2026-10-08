import { Server } from "socket.io";
import cookie from 'cookie';
import jwt from 'jsonwebtoken';

export const InitializeSocket = (server)=>{
    const socketOptions = process.env.NODE_ENV === 'production'
      ? {}
      : {
        cors : {
            origin : process.env.CLIENT_URL || "http://localhost:5173",
            methods : ["GET", "POST"],
            credentials : true
        }
      };

    const io = new Server(server, socketOptions);

    io.on('connection', (socket)=>{
        const cookies = cookie.parse(socket.handshake.headers.cookie || "");
        const token = cookies.token;

        if(!token){
            socket.emit('unauthorized', {message : "Authentication failed"});
            socket.disconnect();
            return;
        }

        try {
            const decodedToken = jwt.verify(token, process.env.JWT_SECRET_KEY);
            socket.userId = decodedToken._id;
        } catch {
            socket.emit('unauthorized', {message : "Authentication failed"});
            socket.disconnect();
            return;
        }

        socket.on("setup", () => {
            socket.join(socket.userId);
            socket.emit("connected");
            console.log(`User joined personal room: ${socket.userId}`);
        });

        socket.on("join chat", (roomId) => {
            socket.join(roomId);
            console.log(`User joined chat room: ${roomId}`);
        });

        socket.on("typing", (roomId) => socket.in(roomId).emit("typing"));
        socket.on("stop typing", (roomId) => socket.in(roomId).emit("stop typing"));

        socket.on("new message", (message) => {
            const roomId = message.conversation;
            if (roomId) {
                socket.to(roomId).emit("new message", message);
                console.log("Message emitted to room:", roomId);
            }
        });

        socket.on('disconnect', ()=>{
            console.log(`User disconnected : ${socket.id}`);
        })
    });

    return io;
};
