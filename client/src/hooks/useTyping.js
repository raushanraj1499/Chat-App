import { useCallback, useEffect, useRef, useState } from 'react';

export default function useTyping(socket, conversation) {
  const id = conversation?._id;
  const sentAt = useRef(0);
  const idle = useRef(null);
  const [typers, setTypers] = useState({});
  const stopTyping = useCallback(() => {
    clearTimeout(idle.current);
    if (sentAt.current && socket?.connected && id) socket.emit('stop typing', id);
    sentAt.current = 0;
  }, [socket, id]);
  const compose = useCallback(value => {
    if (!value.trim()) { stopTyping(); return; }
    if (!socket?.connected || !id) return;
    const now = Date.now();
    if (!sentAt.current || now - sentAt.current >= 1200) {
      socket.emit('typing', id);
      sentAt.current = now;
    }
    clearTimeout(idle.current);
    idle.current = setTimeout(stopTyping, 2500);
  }, [id, socket, stopTyping]);
  useEffect(() => stopTyping, [stopTyping]);
  useEffect(() => {
    if (!socket || !id) return;
    const timers = new Map();
    const remove = key => setTypers(previous => { const next = { ...previous }; delete next[key]; return next; });
    const onTyping = data => {
      if (data.conversationId !== id) return;
      const key = data.typingId || data.userId;
      clearTimeout(timers.get(key));
      setTypers(previous => ({ ...previous, [key]: { ...data, conversationId: id } }));
      timers.set(key, setTimeout(() => remove(key), 4500));
    };
    const onStop = data => {
      if (data.conversationId !== id) return;
      const key = data.typingId || data.userId;
      clearTimeout(timers.get(key)); remove(key);
    };
    const onDisconnect = () => setTypers({});
    socket.on('typing', onTyping); socket.on('stop typing', onStop); socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('typing', onTyping); socket.off('stop typing', onStop); socket.off('disconnect', onDisconnect);
      timers.forEach(clearTimeout);
    };
  }, [socket, id]);
  const names = [...new Set(Object.values(typers).filter(item => item.conversationId === id &&
    conversation.participants.some(member => member._id === item.userId)).map(item =>
    conversation.participants.find(member => member._id === item.userId)?.username || item.username || 'Someone'))];
  return { compose, stopTyping, typingText: names.length ? `${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} typing…` : '' };
}
