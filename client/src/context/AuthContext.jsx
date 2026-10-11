import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api, { advanceSession, onSessionExpired, isCanceled, errorMessage } from '../lib/api.js';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, updateUser] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const request = useRef(null);
  const logoutPending = useRef(null);

  const setUser = useCallback((nextUser) => {
    request.current?.abort();
    advanceSession();
    updateUser(nextUser);
    setError(null);
    setStatus(nextUser ? 'authenticated' : 'unauthenticated');
  }, []);
  const clearSession = useCallback(() => setUser(null), [setUser]);

  const retrySession = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setStatus('loading');
    setError(null);
    try {
      const { data } = await api.get('/api/user/me', {
        signal: controller.signal, skipAuthExpiry: true,
      });
      if (!controller.signal.aborted) setUser(data);
    } catch (err) {
      if (controller.signal.aborted || isCanceled(err)) return;
      if (err.response?.status === 401) clearSession();
      else {
        setError(errorMessage(err, 'Unable to check your session. Please try again.'));
        setStatus('error');
      }
    }
  }, [clearSession, setUser]);

  const logout = useCallback(() => {
    if (logoutPending.current) return logoutPending.current;
    logoutPending.current = api.post('/api/user/logout').then(clearSession).finally(() => {
      logoutPending.current = null;
    });
    return logoutPending.current;
  }, [clearSession]);

  useEffect(() => {
    const unsubscribe = onSessionExpired(clearSession);
    retrySession();
    return () => {
      unsubscribe();
      request.current?.abort();
    };
  }, [clearSession, retrySession]);

  return (
    <AuthContext.Provider value={{ user, setUser, status, loading: status === 'loading', error,
      retrySession, clearSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
