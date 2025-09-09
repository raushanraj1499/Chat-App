import React from 'react';
import styles from '../styles/chat.module.css';
import { useAuth } from '../context/AuthContext.jsx';

const ChatItem = ({ conversation, selectedConversation, setSelectedConversation }) => {
  const { user } = useAuth();

  const getOtherParticipant = (conversation) => {
    if (!conversation || conversation.isGroup) return null;
    return conversation.participants.find(p => p._id !== user._id);
  };

  const otherUser = getOtherParticipant(conversation);

  const getDisplayName = () => {
    if (conversation.isGroup) {
      return conversation.conversationName || 'Group Chat';
    }
    return otherUser?.username || 'Unknown User';
  };

  const getLastMessagePreview = () => {
    if (!conversation.latestMessage) return '';
    
    const isOwnMessage = conversation.latestMessage.sender?._id === user._id;
    const messageText = conversation.latestMessage.content || '';
    
    if (isOwnMessage) {
      return `You: ${messageText}`;
    }
    return messageText;
  };

  return (
    <div
      onClick={() => setSelectedConversation(conversation)}
      className={`${styles.chatItem} ${selectedConversation?._id === conversation._id ? styles.activeChatItem : ''}`}
    >
    <div className={styles.chatItemAvatar}>
      {conversation.isGroup ? (
        <div className={styles.singleAvatarContainer}>
            <img
              src="https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg"
              alt="Group Avatar"
              className={styles.chatItemImage}
            />
    </div>
    ) : (
    <div className={styles.singleAvatarContainer}>
      {otherUser?.avatar ? (
        <img 
          src={otherUser.avatar} 
          alt={otherUser.username || 'User'} 
          className={styles.chatItemImage}
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
      ) : null}
      <svg 
        viewBox="0 0 24 24" 
        fill="currentColor"
        style={{ display: otherUser?.avatar ? 'none' : 'block' }}
      >
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
      </svg>
     </div>
    )}
    </div>
    <div className={styles.chatItemInfo}>
        <div className={styles.chatItemName}>
          {getDisplayName()}
        </div>
        <div className={styles.chatItemPreview}>
          {getLastMessagePreview()}
        </div>
    </div>
      
      {conversation.unreadCount > 0 && (
        <div className={styles.unreadBadge}>
          {conversation.unreadCount}
        </div>
      )}
    </div>
  );
};

export default ChatItem;
