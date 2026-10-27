import { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useConversation } from '../context/ConversationContext.jsx';
import api, { errorMessage } from '../lib/api.js';
import Modal from '../components/Modal.jsx';
import UserPicker from '../components/UserPicker.jsx';
import styles from '../styles/chat.module.css';

const idOf = value => value?._id || value;

function ManageGroup({ conversation, onClose }) {
  const { user } = useAuth();
  const { upsertConversation, removeConversation } = useConversation();
  const [name, setName] = useState(conversation.conversationName);
  const [selected, setSelected] = useState([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const lock = useRef(false);
  const admin = idOf(conversation.groupAdmin) === user._id;
  const members = conversation.participants || [];
  const operate = async (operation, data) => {
    if (lock.current) return;
    lock.current = true; setPending(true); setError('');
    try {
      const response = operation === 'delete'
        ? await api.delete(`/api/conversation/${conversation._id}`)
        : await api.put(`/api/conversation/${conversation._id}`, { operation, data });
      if (response.data.conversation) upsertConversation(response.data.conversation);
      else { removeConversation(conversation._id); onClose(); }
      setSelected([]); setConfirmation(null);
    } catch (error) { setError(errorMessage(error, 'Unable to update group.')); }
    finally { lock.current = false; setPending(false); }
  };
  return <Modal title="Manage group" onClose={onClose} pending={pending}>
    <div className={styles.groupForm}>
      <form onSubmit={event => { event.preventDefault(); operate('rename', { conversationName: name }); }}>
        <label>Group name<input value={name} onChange={event => setName(event.target.value)} maxLength={100} disabled={pending} required /></label>
        <button disabled={pending || !name.trim() || name.trim() === conversation.conversationName}>Rename group</button>
      </form>
      <h3>Members ({members.length})</h3>
      <ul className={styles.memberList}>{members.map(member => <li key={member._id}>
        <span>{member.username}{member._id === user._id ? ' (You)' : ''}{idOf(conversation.groupAdmin) === member._id ? ' · Admin' : ''}</span>
        {admin && member._id !== user._id && <div>
          <button disabled={pending} onClick={() => setConfirmation({ operation: 'transferAdmin', data: { userId: member._id }, text: `Make ${member.username} the admin? You will lose admin controls.` })}>Make admin</button>
          <button disabled={pending} onClick={() => setConfirmation({ operation: 'removeMember', data: { userId: member._id }, text: `Remove ${member.username} from this group?` })}>Remove</button>
        </div>}
      </li>)}</ul>
      <UserPicker excludedIds={members.map(member => member._id)} selected={selected} onChange={setSelected} disabled={pending} />
      <button disabled={pending || !selected.length} onClick={() => operate('addMembers', { participants: selected.map(member => member._id) })}>Add selected members</button>
      {admin && members.length > 1 && <p>Transfer administration to another member before leaving.</p>}
      <div className={styles.groupActions}>
        {!admin && <button disabled={pending} onClick={() => setConfirmation({ operation: 'leave', text: 'Leave this group? Your access ends immediately.' })}>Leave group</button>}
        {admin && <button disabled={pending} onClick={() => setConfirmation({ operation: 'delete', text: 'Delete this group for everyone? This cannot be undone.' })}>Delete group</button>}
      </div>
      {confirmation && <div className={styles.confirmation} role="alert">
        <p>{confirmation.text}</p>
        <button disabled={pending} onClick={() => operate(confirmation.operation, confirmation.data)}>{pending ? 'Working…' : 'Confirm'}</button>
        <button disabled={pending} onClick={() => setConfirmation(null)}>Cancel</button>
      </div>}
      {error && <p role="alert">{error}</p>}
      {pending && <p role="status">Saving changes…</p>}
    </div>
  </Modal>;
}

export default function UpdateGroupModal({ selectedConversation, open, onClose }) {
  return open && selectedConversation?.isGroup
    ? <ManageGroup key={selectedConversation._id} conversation={selectedConversation} onClose={onClose} /> : null;
}
