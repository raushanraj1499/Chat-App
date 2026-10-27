import { useRef, useEffect, useLayoutEffect, useState } from 'react';
import styles from '../styles/chat.module.css';
import { useAuth } from '../context/AuthContext.jsx';
import { useConversation } from '../context/ConversationContext.jsx';
import api, { errorMessage } from '../lib/api.js';
import Modal from './Modal.jsx';

function MessageActions({ message, onChange }) {
  const [action, setAction] = useState(null);
  const [content, setContent] = useState(message.content);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const mutate = async event => {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setPending(true); setError('');
    try {
      const path = `/api/message/${message.conversation?._id || message.conversation}/${message._id}`;
      const { data } = action === 'edit' ? await api.patch(path, { content }) : await api.delete(path);
      onChange(data.data); setAction(null);
    } catch (error) { setError(errorMessage(error, 'Unable to change message.')); }
    finally { lock.current = false; setPending(false); }
  };
  if (message.deletedAt) return null;
  return <>
    <div className={styles.messageActions}>
      <button onClick={() => { setContent(message.content); setError(''); setAction('edit'); }}>Edit</button>
      <button onClick={() => { setError(''); setAction('delete'); }}>Delete</button>
    </div>
    {action && <Modal title={action === 'edit' ? 'Edit message' : 'Delete message'} onClose={() => setAction(null)} pending={pending}>
      <form className={styles.groupForm} onSubmit={mutate}>
        {action === 'edit' ? <label>Message content<textarea value={content} onChange={event => setContent(event.target.value)} maxLength={10000} required disabled={pending} /></label>
          : <p>Delete this message? Its sender and timestamp will remain.</p>}
        {error && <p role="alert">{error}</p>}
        <div className={styles.groupActions}>
          <button type="submit" disabled={pending || (action === 'edit' && !content.trim())}>{pending ? 'Saving…' : action === 'edit' ? 'Save changes' : 'Confirm deletion'}</button>
          <button type="button" disabled={pending} onClick={() => setAction(null)}>Cancel</button>
        </div>
      </form>
    </Modal>}
  </>;
}

export default function MessageList({ messages, selectedConversation, setShowGroupMembers, historyState, loadOlder }) {
  const { user } = useAuth();
  const { applyMessage, upsertConversation } = useConversation();
  const area = useRef(null);
  const nearBottom = useRef(true);
  const initialized = useRef(false);
  const prepend = useRef(null);
  const [readSignal, setReadSignal] = useState(0);
  const [readError, setReadError] = useState('');
  const readPosition = useRef(null);
  const lastId = messages.at(-1)?._id;
  const conversationId = selectedConversation._id;

  useLayoutEffect(() => {
    const element = area.current;
    if (!element) return;
    if (prepend.current && messages[0]?._id !== prepend.current.firstId) {
      element.scrollTop = prepend.current.top + element.scrollHeight - prepend.current.height;
      prepend.current = null;
    } else if ((!initialized.current || nearBottom.current) && messages.length) {
      element.scrollTop = element.scrollHeight;
      initialized.current = true;
    }
  }, [messages]);

  useEffect(() => {
    const onFocus = () => setReadSignal(value => value + 1);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, []);

  useEffect(() => {
    if (!lastId || historyState?.loading || document.visibilityState !== 'visible' || !document.hasFocus() ||
      !nearBottom.current || readPosition.current === lastId ||
      area.current.scrollHeight - area.current.scrollTop - area.current.clientHeight > 2) return;
    let active = true;
    const controller = new AbortController();
    readPosition.current = lastId;
    api.post(`/api/conversation/${conversationId}/read`, { messageId: lastId }, { signal: controller.signal }).then(({ data }) => {
      if (active) { upsertConversation(data.conversation); setReadError(''); }
    }).catch(error => {
      if (active) { readPosition.current = null; setReadError(errorMessage(error, 'Unable to mark messages read.')); }
    });
    return () => { active = false; controller.abort(); if (readPosition.current === lastId) readPosition.current = null; };
  }, [conversationId, lastId, readSignal, historyState?.loading, upsertConversation]);

  const older = async () => {
    const element = area.current;
    prepend.current = { height: element.scrollHeight, top: element.scrollTop, firstId: messages[0]?._id };
    await loadOlder();
  };
  return <>
    <div className={styles.chatHeader}>
      <h2 className={styles.chatName}>{selectedConversation.isGroup ? selectedConversation.conversationName
        : selectedConversation.participants?.find(member => member._id !== user._id)?.username || 'Unknown User'}</h2>
      {selectedConversation.isGroup && <button onClick={() => setShowGroupMembers(true)}>Manage group · {selectedConversation.participants.length} members</button>}
    </div>
    {readError && <div className={styles.requestStatus} role="alert">{readError}<button onClick={() => setReadSignal(value => value + 1)}>Retry read status</button></div>}
    <div className={styles.messagesArea} role="log" aria-label="Messages" ref={area} onScroll={() => {
      const element = area.current;
      const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
      nearBottom.current = remaining < 80;
      if (remaining <= 2 && readPosition.current !== lastId) setReadSignal(value => value + 1);
    }}>
      {historyState?.nextCursor && <button className={styles.loadOlder} disabled={historyState.loading || historyState.olderLoading} onClick={older}>
        {historyState.olderLoading ? 'Loading older messages…' : 'Load older messages'}</button>}
      {historyState?.olderError && <p role="alert">{historyState.olderError}</p>}
      {!messages.length && !historyState?.loading && <p className={styles.requestStatus}>No messages yet. Start the conversation.</p>}
      {messages.map(message => {
        const own = message.sender?._id === user._id;
        return <div key={message._id} className={`${styles.message} ${own ? styles.ownMessage : styles.otherMessage}`}>
          <div className={styles.messageContent}>
            <div className={styles.messageBubble}>
              <span className={styles.messageSender}>{own ? 'You' : message.sender?.username || 'Unknown user'}</span>
              <p className={message.deletedAt ? styles.deletedMessage : undefined}>{message.deletedAt ? 'Message deleted' : message.content}</p>
              <span className={styles.messageTime}>{message.isEdited && !message.deletedAt && 'Edited · '}
                <time dateTime={message.createdAt} title={new Date(message.createdAt).toLocaleString()}>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
              </span>
              {own && <MessageActions message={message} onChange={applyMessage} />}
            </div>
            <div className={styles.messageAvatar} aria-hidden="true">{message.sender?.avatar
              ? <img src={message.sender.avatar} alt="" /> : (message.sender?.username?.[0] || '?')}</div>
          </div>
        </div>;
      })}
    </div>
  </>;
}
