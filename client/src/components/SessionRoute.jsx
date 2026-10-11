import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import LoadingSpinner from './LoadingSpinner.jsx';

export default function SessionRoute({ guestOnly = false, home = false }) {
  const { user, status, error, retrySession } = useAuth();
  if (status === 'loading') return <LoadingSpinner />;
  if (status === 'error') {
    return (
      <div className="sessionError" role="alert">
        <h1>Unable to load your session</h1>
        <p>{error}</p>
        <button onClick={retrySession}>Retry</button>
      </div>
    );
  }
  if (home) return <Navigate to={user ? '/chat' : '/login'} replace />;
  if (guestOnly && user) return <Navigate to="/chat" replace />;
  if (!guestOnly && !user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
