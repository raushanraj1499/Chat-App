import { createContext, useEffect, useContext, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [connectionVersion, setConnectionVersion] = useState(0);
  const { user, clearSession } = useAuth();
  const userId = user?._id;

  useEffect(() => {
    if (!userId) return;
    let retryTimer;
    const nextSocket = io(import.meta.env.VITE_SOCKET_URL || undefined, {
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
    setSocket(nextSocket);
    setConnectionStatus('connecting');
    nextSocket.on('connect', () => {
      clearTimeout(retryTimer);
      setConnectionStatus('connected');
      setConnectionVersion(previous => previous + 1);
    });
    nextSocket.on('unauthorized', () => {
      nextSocket.disconnect();
      clearSession();
    });
    nextSocket.on('connect_error', (error) => {
      if (error.data?.code === 'UNAUTHORIZED') {
        nextSocket.disconnect();
        clearSession();
      } else {
        setConnectionStatus('reconnecting');
        if (!nextSocket.active) retryTimer = setTimeout(() => nextSocket.connect(), 3000);
      }
    });
    nextSocket.on('disconnect', (reason) => {
      setConnectionStatus('reconnecting');
      if (reason === 'io server disconnect') nextSocket.connect();
    });
    nextSocket.io.on('reconnect_attempt', () => setConnectionStatus('reconnecting'));
    return () => {
      clearTimeout(retryTimer);
      nextSocket.removeAllListeners();
      nextSocket.io.removeAllListeners();
      nextSocket.disconnect();
    };
  }, [userId, clearSession]);

  const retryConnection = useCallback(() => socket?.connect(), [socket]);
  return (
    <SocketContext.Provider value={{ socket, connectionStatus, connectionVersion, retryConnection }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
