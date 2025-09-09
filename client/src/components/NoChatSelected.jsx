import React from 'react';
import styles from '../styles/chat.module.css';

const NoChatSelected = () => {
  return (
    <div className={styles.noChatSelected}>
      <div className={styles.noChatContent}>
        <div className={styles.iconContainer}>
          <svg viewBox="0 0 120 80" className={styles.noChatIcon}>
            {/* Main chat bubble */}
            <rect x="20" y="20" width="50" height="30" rx="15" fill="#e5e7eb" opacity="0.8"/>
            <circle cx="35" cy="30" r="2" fill="#9ca3af"/>
            <circle cx="42" cy="30" r="2" fill="#9ca3af"/>
            <circle cx="49" cy="30" r="2" fill="#9ca3af"/>
            
            {/* Second chat bubble */}
            <rect x="50" y="35" width="45" height="25" rx="12" fill="#3b82f6" opacity="0.6"/>
            <rect x="58" y="42" width="20" height="2" rx="1" fill="white"/>
            <rect x="58" y="46" width="15" height="2" rx="1" fill="white"/>
          </svg>
        </div>
        
        <h3>Welcome to 360Link</h3>
        <p>Select a conversation to start messaging</p>
        
        {/* <div className={styles.noChatActions}>
          <button 
            className={styles.primaryAction}
            onClick={onCreateGroup}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            Start New Chat
          </button>
        </div> */}
      </div>
    </div>
  );
};

export default NoChatSelected;
