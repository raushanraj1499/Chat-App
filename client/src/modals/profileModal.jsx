import React from 'react';
import styles from "../styles/profileModal.module.css";

const ProfileModal = ({ open, onClose, username, email, avatar }) => {
  if (!open) return null;

  return (
    <div className={styles.modal}>
      <div className={styles.card}>
        <button className={styles.closeButton} onClick={onClose} aria-label="Close">
          &times;
        </button>
        <div className={styles.username}>{username}</div>
        <img
          src={avatar}
          alt="avatar"
          className={styles.avatar}
        />
        <div className={styles.email}>Email: {email}</div>
        <button className={styles.button} onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default ProfileModal;
