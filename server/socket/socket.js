import { Server } from "socket.io";
import cookie from 'cookie';

export const InitializeSocket = (server)=>{
    const io = new Server(server, {
        cors : {
            origin : "http://localhost:5173",
            methods : ["GET", "POST"],
            credentials : true
        }
    });

    io.on('connection', (socket)=>{
        const cookies = cookie.parse(socket.handshake.headers.cookie || "");
        const token = cookies.token;

        if(!token){
            socket.emit('unauthorized', {message : "Authentication failed"});
            socket.disconnect();
            return;
        }

        socket.on("setup", (userData) => {
            socket.join(userData._id);
            socket.emit("connected");
            console.log(`User joined personal room: ${userData._id}`);
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
