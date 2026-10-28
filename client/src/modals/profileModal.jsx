import React, { useEffect, useRef, useState } from 'react';
import styles from "../styles/profileModal.module.css";
import api, { errorMessage } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import toast from 'react-hot-toast';

const ProfileModal = ({ open, onClose, username, email, avatar }) => {
  const { setUser } = useAuth();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!file) {
      setPreview('');
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!open) setFile(null);
  }, [open]);

  if (!open) return null;

  const chooseFile = (event) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (!selected.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      event.target.value = '';
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      toast.error('Avatar must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }
    setFile(selected);
  };

  const saveAvatar = async () => {
    if (!file || saving) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const { data } = await api.patch('/api/user/me/avatar', formData);
      setUser(data.user);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      toast.success(data.message || 'Avatar updated successfully');
    } catch (error) {
      toast.error(errorMessage(error, 'Unable to update avatar. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.modal} role="presentation">
      <div className={styles.card} role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close profile" disabled={saving}>
          &times;
        </button>
        <div id="profile-title" className={styles.username}>{username}</div>
        <img
          src={preview || avatar}
          alt={`${username}'s avatar`}
          className={styles.avatar}
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          aria-label="Avatar image"
          tabIndex="-1"
          onChange={chooseFile}
          className={styles.fileInput}
          disabled={saving}
        />
        <button type="button" className={styles.changeButton} onClick={() => inputRef.current?.click()} disabled={saving}>
          {file ? 'Choose another image' : 'Change avatar'}
        </button>
        <p className={styles.hint}>Image files up to 5 MB</p>
        <div className={styles.email}>Email: {email}</div>
        <div className={styles.actions}>
          {file && (
            <button type="button" className={styles.saveButton} onClick={saveAvatar} disabled={saving}>
              {saving ? 'Saving…' : 'Save avatar'}
            </button>
          )}
          <button type="button" className={styles.button} onClick={onClose} disabled={saving}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
