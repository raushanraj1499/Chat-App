import React from 'react';
import styles from '../styles/chat.module.css';
import ChatItem from './ChatItem.jsx';

const ChatList = ({ 
  conversations, 
  selectedConversation, 
  setSelectedConversation, 
  setGroupModalOpen 
}) => {
  return (
    <aside className={styles.rightPanel}>
      <div className={styles.rightHeader}>
        <h2 className={styles.sectionTitle}>My Chats</h2>
        <div className={styles.newGroupRow}>
          <span>New Group Chat</span>
          <button 
            className={styles.addButton} 
            onClick={() => setGroupModalOpen(true)}
            aria-label="Create group"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
          </button>
        </div>
      </div>
      
      <div className={styles.chatList}>
        {conversations && conversations.length > 0 ? (
          conversations.map((conversation) => (
            <ChatItem
              key={conversation._id}
              conversation={conversation}
              selectedConversation={selectedConversation}
              setSelectedConversation={setSelectedConversation}
            />
          ))
        ) : (
          <div className={styles.emptyChatList}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
            </svg>
            <p>No conversations yet</p>
          </div>
        )}
      </div>
    </aside>
  );
};

export default ChatList;
