import { useState, useRef, useEffect } from "react";
import styles from '../styles/chat.module.css';
import Sidebar from "../components/Sidebar.jsx";
import ChatHeader from "../components/ChatHeader.jsx";
import ChatList from "../components/ChatList.jsx";
import MessageList from "../components/MessageList.jsx";
import NoChatSelected from "../components/NoChatSelected.jsx";
import ProfileModal from "../modals/profileModal.jsx";
import AddGroupModal from "../modals/addGroupModal.jsx";
import api, { isCanceled, errorMessage } from "../lib/api.js";
import toast from 'react-hot-toast';
import { useAuth } from "../context/AuthContext.jsx";
import { useConversation } from "../context/ConversationContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import GroupMembersListModal from "../modals/GroupMembersListModal.jsx";
import useTyping from '../hooks/useTyping.js';

const Chat = () => {
  const { user } = useAuth();
  const { socket, connectionStatus, connectionVersion, retryConnection } = useSocket();
  const { selectedConversation, setSelectedConversation, conversations,
    messages, addMessages, captureVersions, reconcileConversations, removeConversation, upsertConversation, applyMessage } = useConversation();
  const conversationId = selectedConversation?._id;
  const joinedAt = selectedConversation?.joinedAt;
  const joinedAfter = selectedConversation?.joinedAfterMessageId;
  const { compose, stopTyping, typingText } = useTyping(socket, selectedConversation);
  const [drafts, setDrafts] = useState({});
  const [pendingSends, setPendingSends] = useState({});
  const sendLocks = useRef(new Set());
  const startingConversation = useRef(false);
  const mounted = useRef(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showGroupMembers, setShowGroupMembers] = useState(false);
  const [conversationState, setConversationState] = useState({ loading: true, error: null });
  const [historyState, setHistoryState] = useState({});
  const [conversationRetry, setConversationRetry] = useState(0);
  const [historyRetry, setHistoryRetry] = useState(0);
  const olderRequests = useRef(new Map());

  useEffect(() => { setShowGroupMembers(false); }, [conversationId]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const snapshot = captureVersions();
    setConversationState({ loading: true, error: null });
    api.get('/api/conversation', { signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return;
      reconcileConversations(data.conversations, snapshot);
      setConversationState({ loading: false, error: null });
    }).catch(error => {
      if (!controller.signal.aborted && !isCanceled(error)) {
        setConversationState({ loading: false, error: errorMessage(error, 'Unable to load conversations.') });
      }
    });
    return () => controller.abort();
  }, [captureVersions, reconcileConversations, conversationRetry, connectionVersion]);

  // Refresh on selection, retry and reconnection; preview changes do not refetch.
  useEffect(() => {
    if (!conversationId) return;
    const controller = new AbortController();
    const visibilityKey = `${joinedAt || ''}:${joinedAfter || ''}`;
    setHistoryState(previous => ({ ...previous, [conversationId]: { ...previous[conversationId], loading: true, error: null } }));
    api.get('/api/message/' + conversationId, { signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return;
      addMessages(conversationId, data.messages, true);
      setHistoryState(previous => ({ ...previous, [conversationId]: { loading: false, error: null, visibilityKey,
        nextCursor: data.nextCursor } }));
    }).catch(error => {
      if (!controller.signal.aborted && !isCanceled(error)) {
        if ([403, 404].includes(error.response?.status)) removeConversation(conversationId);
        setHistoryState(previous => ({ ...previous, [conversationId]: {
          loading: false, error: errorMessage(error, 'Unable to load messages.'),
        } }));
      }
    });
    return () => controller.abort();
  }, [conversationId, joinedAt, joinedAfter, historyRetry, connectionVersion, addMessages, removeConversation]);

  useEffect(() => {
    const requests = olderRequests.current;
    return () => { requests.forEach(controller => controller.abort()); requests.clear(); };
  }, [conversationId, joinedAt, joinedAfter]);

  const loadOlder = async () => {
    const cursor = historyState[conversationId]?.nextCursor;
    if (!cursor || olderRequests.current.has(conversationId)) return;
    const controller = new AbortController();
    olderRequests.current.set(conversationId, controller);
    setHistoryState(previous => ({ ...previous, [conversationId]: { ...previous[conversationId], olderLoading: true, olderError: null } }));
    try {
      const { data } = await api.get(`/api/message/${conversationId}`, { params: { before: cursor, limit: 50 }, signal: controller.signal });
      if (controller.signal.aborted) return;
      addMessages(conversationId, data.messages);
      setHistoryState(previous => ({ ...previous, [conversationId]: { ...previous[conversationId], nextCursor: data.nextCursor, olderLoading: false } }));
    } catch (error) {
      if (!controller.signal.aborted && !isCanceled(error)) {
        if ([403, 404].includes(error.response?.status)) removeConversation(conversationId);
        setHistoryState(previous => ({ ...previous, [conversationId]: { ...previous[conversationId], olderLoading: false, olderError: errorMessage(error, 'Unable to load older messages.') } }));
      }
    } finally { if (olderRequests.current.get(conversationId) === controller) olderRequests.current.delete(conversationId); }
  };

  // Joining a room is independent of HTTP history and repeats after reconnect.
  useEffect(() => {
    if (socket?.connected && conversationId) socket.emit("join chat", conversationId);
    return () => {
      if (socket?.connected && conversationId) socket.emit('leave chat', conversationId);
    };
  }, [socket, connectionStatus, connectionVersion, conversationId]);

  const startConversation = async (selectedUser) => {
    if (startingConversation.current) return;
    const existing = conversations.find(conversation =>
      !conversation.isGroup && conversation.participants.some(participant => participant._id === selectedUser._id));
    if (existing) setSelectedConversation(existing);
    else {
      startingConversation.current = true;
      try {
        const { data } = await api.post('/api/conversation', { participants: [selectedUser._id] });
        if (!mounted.current) return;
        upsertConversation(data.conversation);
        setSelectedConversation(data.conversation);
      } catch (error) {
        if (mounted.current) toast.error(errorMessage(error, 'Unable to start a conversation.'));
        return;
      } finally {
        startingConversation.current = false;
      }
    }
    setSearchTerm('');
    setSearchResults([]);
    setShowSearchResults(false);
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    const content = drafts[conversationId] || '';
    if (!content.trim() || !conversationId || sendLocks.current.has(conversationId)) return;
    sendLocks.current.add(conversationId);
    setPendingSends(previous => ({ ...previous, [conversationId]: true }));
    stopTyping();
    try {
      const { data } = await api.post('/api/message/' + conversationId, { content });
      if (!mounted.current) return;
      const message = data.data;
      applyMessage(message);
      // Do not discard text the user wrote while this request was pending.
      setDrafts(previous => previous[conversationId] === content
        ? { ...previous, [conversationId]: '' } : previous);
    } catch (error) {
      if (mounted.current) toast.error(errorMessage(error, 'Unable to send message. Please try again.'));
    } finally {
      sendLocks.current.delete(conversationId);
      if (mounted.current) setPendingSends(previous => ({ ...previous, [conversationId]: false }));
    }
  };

  const currentHistory = historyState[conversationId];
  return (
    <div className={styles.appContainer}>
      <Sidebar />
      <div className={styles.mainContent}>
        <ChatHeader searchTerm={searchTerm} setSearchTerm={setSearchTerm}
          searchResults={searchResults} setSearchResults={setSearchResults}
          showSearchResults={showSearchResults} setShowSearchResults={setShowSearchResults}
          startConversation={startConversation} setProfileOpen={setProfileOpen} />
        <div className={styles.connectionStatus} role="status" aria-live="polite">
          {connectionStatus === 'connected' ? 'Live updates connected' : (
            <>
              {connectionStatus === 'connecting' ? 'Connecting live updates…' : 'Live updates reconnecting…'}
              {' You can still load and send messages.'}
              <button onClick={retryConnection}>Retry connection</button>
            </>
          )}
        </div>
        <div className={styles.main}>
          <main className={styles.chatSection}>
            {selectedConversation ? (
              <>
                {currentHistory?.loading && <p className={styles.requestStatus} role="status">Loading messages…</p>}
                {currentHistory?.error && (
                  <div className={styles.requestStatus} role="alert">
                    {currentHistory.error}
                    <button onClick={() => setHistoryRetry(previous => previous + 1)}>Retry messages</button>
                  </div>
                )}
                <MessageList key={`${conversationId}:${joinedAt || ''}:${joinedAfter || ''}`} messages={messages[conversationId] || []}
                  selectedConversation={selectedConversation} setShowGroupMembers={setShowGroupMembers}
                  historyState={currentHistory} loadOlder={loadOlder} />
                <div className={styles.typingIndicator} role="status" aria-live="polite">{typingText}</div>
                <form onSubmit={handleSendMessage} className={styles.messageInputArea}>
                  <input type="text" placeholder="Write your message" aria-label="Message"
                    value={drafts[conversationId] || ''}
                    onChange={(event) => { const value = event.target.value; setDrafts(previous => ({ ...previous, [conversationId]: value })); compose(value); }}
                    onBlur={stopTyping}
                    className={styles.messageInput} />
                  <button type="submit" className={styles.sendButton}
                    disabled={pendingSends[conversationId] || !drafts[conversationId]?.trim()}
                    aria-label={pendingSends[conversationId] ? 'Sending message' : 'Send message'}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  </button>
                </form>
              </>
            ) : <NoChatSelected />}
          </main>
          <ChatList conversations={conversations} selectedConversation={selectedConversation}
            setSelectedConversation={setSelectedConversation} setGroupModalOpen={setGroupModalOpen}
            loading={conversationState.loading} error={conversationState.error}
            onRetry={() => setConversationRetry(previous => previous + 1)} />
        </div>
        <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)}
          username={user.username} email={user.email} avatar={user.avatar} />
        <AddGroupModal open={groupModalOpen} onClose={() => setGroupModalOpen(false)} />
        <GroupMembersListModal selectedConversation={selectedConversation}
          open={showGroupMembers} onClose={() => setShowGroupMembers(false)} />
      </div>
    </div>
  );
};

export default Chat;
