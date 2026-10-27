import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { mergeMessages, conversationIdOf, isVisibleMessage } from '../lib/messages.js';
import { mergeConversations, sortConversations } from '../lib/conversations.js';

const ConversationContext = createContext();

export const ConversationProvider = ({ children }) => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState({});
  const { user, setUser } = useAuth();
  const { socket } = useSocket();
  const versions = useRef(new Map());
  const removed = useRef(new Set());
  const visibility = useRef(new Map());
  const captureVersions = useCallback(() => new Map(versions.current), []);
  const touch = useCallback(id => versions.current.set(id, (versions.current.get(id) || 0) + 1), []);

  const addMessages = useCallback((conversationId, incoming, recentPage = false) => {
    if (removed.current.has(conversationId)) return;
    setMessages(previous => {
      const boundary = recentPage ? mergeMessages([], incoming)[0] : null;
      // A reconnect may miss more than one page. Restart its contiguous window
      // at the new page, retaining newer live messages and edits raced by HTTP.
      const items = mergeMessages(previous[conversationId], incoming).filter(message =>
        isVisibleMessage(message, visibility.current.get(conversationId)) && (!boundary ||
          new Date(message.createdAt) > new Date(boundary.createdAt) ||
          (+new Date(message.createdAt) === +new Date(boundary.createdAt) && message._id >= boundary._id)));
      return { ...previous, [conversationId]: items };
    });
  }, []);

  const removeConversation = useCallback(id => {
    touch(id);
    removed.current.add(id);
    setConversations(previous => previous.filter(item => item._id !== id));
    setSelectedConversation(previous => previous?._id === id ? null : previous);
    setMessages(previous => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
  }, [touch]);

  const upsertConversation = useCallback((conversation, restore = false) => {
    if (!conversation?._id) return;
    const id = conversation._id;
    if (removed.current.has(id) && !restore) return;
    const current = visibility.current.get(id);
    if (current?.revision !== undefined && conversation.revision !== undefined && current.revision > conversation.revision) return;
    touch(id);
    removed.current.delete(id);
    visibility.current.set(id, conversation);
    setMessages(previous => previous[id] ? { ...previous, [id]: previous[id].filter(message => isVisibleMessage(message, conversation)) } : previous);
    setConversations(previous => mergeConversations(previous, [conversation]));
    setSelectedConversation(previous => previous?._id === id
      ? mergeConversations([previous], [conversation])[0] : previous);
  }, [touch]);

  // The snapshot is authoritative for membership, unless an event for that ID
  // arrived after the request started. This also removes chats missed offline.
  const reconcileConversations = useCallback((incoming, snapshot) => {
    const remote = new Map(incoming.map(item => [item._id, item]));
    const changed = id => (versions.current.get(id) || 0) !== (snapshot.get(id) || 0);
    for (const id of versions.current.keys()) {
      if (changed(id) && removed.current.has(id)) remote.delete(id);
    }
    for (const id of removed.current) {
      if (!changed(id) && remote.has(id)) removed.current.delete(id);
    }
    for (const [id, conversation] of remote) {
      const current = visibility.current.get(id);
      if (current?.revision !== undefined && conversation.revision !== undefined && current.revision > conversation.revision) remote.set(id, current);
      else if (!changed(id)) visibility.current.set(id, conversation);
    }
    setConversations(previous => {
      const result = new Map(remote);
      previous.forEach(item => {
        if (changed(item._id) && !removed.current.has(item._id)) result.set(item._id, item);
      });
      return sortConversations([...result.values()]);
    });
    setSelectedConversation(previous => {
      if (!previous || changed(previous._id)) return previous;
      return remote.get(previous._id) || null;
    });
    setMessages(previous => Object.fromEntries(Object.entries(previous).filter(([id]) =>
      remote.has(id) || (changed(id) && !removed.current.has(id))).map(([id, items]) =>
      [id, items.filter(message => isVisibleMessage(message, visibility.current.get(id)))])));
  }, []);

  const applyMessage = useCallback(message => {
    const id = conversationIdOf(message);
    if (!id || !message?._id || removed.current.has(id)) return;
    if (message.conversationSummary) upsertConversation(message.conversationSummary);
    else {
      touch(id);
      setConversations(previous => sortConversations(previous.map(conversation => {
        if (conversation._id !== id) return conversation;
        const latest = conversation.latestMessage;
        if (latest && latest._id !== message._id && new Date(latest.createdAt) > new Date(message.createdAt)) return conversation;
        const latestMessage = latest?._id === message._id ? mergeMessages([latest], [message])[0] : message;
        const updatedAt = new Date(conversation.updatedAt || 0) > new Date(message.createdAt)
          ? conversation.updatedAt : message.createdAt;
        return { ...conversation, latestMessage, updatedAt };
      })));
    }
    addMessages(id, [message]);
  }, [addMessages, upsertConversation, touch]);

  useEffect(() => {
    if (!socket) return;
    const onConversation = ({ conversation }) => upsertConversation(conversation, true);
    const onRemoval = ({ conversationId }) => removeConversation(conversationId);
    const events = ['new message', 'message updated', 'message deleted'];
    events.forEach(event => socket.on(event, applyMessage));
    socket.on('conversation updated', onConversation);
    socket.on('conversation removed', onRemoval);
    return () => {
      events.forEach(event => socket.off(event, applyMessage));
      socket.off('conversation updated', onConversation);
      socket.off('conversation removed', onRemoval);
    };
  }, [socket, applyMessage, upsertConversation, removeConversation]);

  return (
    <ConversationContext.Provider value={{ conversations, setConversations, selectedConversation,
      setSelectedConversation, messages, setMessages, addMessages, captureVersions,
      reconcileConversations, removeConversation, upsertConversation, applyMessage, user, setUser }}>
      {children}
    </ConversationContext.Provider>
  );
};

export const useConversation = () => useContext(ConversationContext);
