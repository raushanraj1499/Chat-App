import { useRef, useState } from 'react';
import api, { errorMessage } from '../lib/api.js';
import { useConversation } from '../context/ConversationContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Modal from '../components/Modal.jsx';
import UserPicker from '../components/UserPicker.jsx';
import styles from '../styles/chat.module.css';

function CreateGroup({ onClose }) {
  const { user } = useAuth();
  const { upsertConversation, setSelectedConversation } = useConversation();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const create = async event => {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setPending(true); setError('');
    try {
      const { data } = await api.post('/api/conversation/group', { conversationName: name.trim(), participants: selected.map(user => user._id) });
      upsertConversation(data.conversation);
      setSelectedConversation(data.conversation);
      onClose();
    } catch (error) { setError(errorMessage(error, 'Unable to create group.')); }
    finally { lock.current = false; setPending(false); }
  };
  return <Modal title="Create Group Chat" onClose={onClose} pending={pending}>
    <form onSubmit={create} className={styles.groupForm}>
      <label>Group name<input value={name} onChange={event => setName(event.target.value)} maxLength={100} required disabled={pending} /></label>
      <UserPicker excludedIds={[user._id]} selected={selected} onChange={setSelected} disabled={pending} />
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={pending || !name.trim() || !selected.length}>{pending ? 'Creating…' : 'Create Chat'}</button>
    </form>
  </Modal>;
}

export default function AddGroupModal({ open, onClose }) {
  return open ? <CreateGroup onClose={onClose} /> : null;
}
