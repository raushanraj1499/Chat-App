import { useEffect, useState } from 'react';
import api, { errorMessage, isCanceled } from '../lib/api.js';
import styles from '../styles/chat.module.css';

export default function UserPicker({ excludedIds, selected, onChange, disabled }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [state, setState] = useState({});
  useEffect(() => {
    const controller = new AbortController();
    setResults([]);
    setState({ loading: search.trim().length >= 2 });
    const timer = setTimeout(async () => {
      if (search.trim().length < 2) return;
      try {
        const { data } = await api.get('/api/user/search', { params: { q: search.trim() }, signal: controller.signal });
        if (!controller.signal.aborted) { setResults(data.users || []); setState({}); }
      } catch (error) {
        if (!controller.signal.aborted && !isCanceled(error)) setState({ error: errorMessage(error, 'Unable to search users.') });
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search]);
  const available = results.filter(user => !excludedIds.includes(user._id) && !selected.some(item => item._id === user._id));
  return <div className={styles.userPicker}>
    <label>Find members<input value={search} onChange={event => setSearch(event.target.value)} disabled={disabled} placeholder="Search by username" /></label>
    <div className={styles.selectedUsers}>{selected.map(user => <button type="button" key={user._id} disabled={disabled}
      onClick={() => onChange(selected.filter(item => item._id !== user._id))} aria-label={`Deselect ${user.username}`}>{user.username} ×</button>)}</div>
    {state.loading && <p role="status">Searching…</p>}
    {state.error && <p role="alert">{state.error}</p>}
    {!state.loading && !state.error && search.trim().length >= 2 && !available.length && <p>No matching users available.</p>}
    <div className={styles.pickerResults}>{available.map(user => <button type="button" key={user._id} disabled={disabled}
      onClick={() => onChange([...selected, user])}>Add {user.username}</button>)}</div>
  </div>;
}
