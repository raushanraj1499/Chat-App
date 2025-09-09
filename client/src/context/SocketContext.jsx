  import { createContext, useEffect, useContext, useState } from 'react';
  import { io } from 'socket.io-client';
  import { useAuth } from './AuthContext';

  const SocketContext = createContext(null);

  export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const { user } = useAuth();

    useEffect(() => {
      if (!user) return;

      const newSocket = io("http://localhost:3000", {
        withCredentials: true,
        transports: ['websocket'],
      });

      newSocket.on('connect', () => {
        console.log('Socket connected');
        newSocket.emit('setup', user); 
      });

      newSocket.on('connected', () => {
        console.log("User setup complete");
      });

      newSocket.on('unauthorized', (data) => {
        console.error("Socket unauthorized:", data.message);
        newSocket.disconnect();
      });

      newSocket.on('disconnect', () => {
        console.log("Socket disconnected");
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }, [user]);

    return (
      <SocketContext.Provider value={{socket}}>
        {children}
      </SocketContext.Provider>
    );
  };

export const useSocket = ()=> useContext(SocketContext);
