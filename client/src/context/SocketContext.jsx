import { createContext, useEffect, useContext, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const { user, clearSession } = useAuth();
  const userId = user?._id;

  useEffect(() => {
    if (!userId) return;
    const nextSocket = io({
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
    setSocket(nextSocket);
    setConnectionStatus('connecting');
    nextSocket.on('connect', () => {
      setConnectionStatus('connected');
      nextSocket.emit('setup');
    });
    nextSocket.on('unauthorized', () => {
      nextSocket.disconnect();
      clearSession();
    });
    nextSocket.on('connect_error', () => setConnectionStatus('reconnecting'));
    nextSocket.on('disconnect', (reason) => {
      setConnectionStatus('reconnecting');
      if (reason === 'io server disconnect') nextSocket.connect();
    });
    nextSocket.io.on('reconnect_attempt', () => setConnectionStatus('reconnecting'));
    return () => {
      nextSocket.removeAllListeners();
      nextSocket.io.removeAllListeners();
      nextSocket.disconnect();
    };
  }, [userId, clearSession]);

  const retryConnection = useCallback(() => socket?.connect(), [socket]);
  return (
    <SocketContext.Provider value={{ socket, connectionStatus, retryConnection }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
