import { useAuth } from './AuthContext.jsx';
import { SocketProvider } from './SocketContext.jsx';
import { ConversationProvider } from './ConversationContext.jsx';

export default function SessionProviders({ children }) {
  const { user } = useAuth();
  // Changing sessions discards stores, drafts, requests, and the old socket.
  return (
    <SocketProvider key={user?._id || 'signed-out'}>
      <ConversationProvider>{children}</ConversationProvider>
    </SocketProvider>
  );
}
