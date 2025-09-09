import React, { useRef, useEffect } from 'react';
import styles from '../styles/chat.module.css';
import { useAuth } from '../context/AuthContext.jsx';

const MessageList = ({ messages, selectedConversation, setShowGroupMembers }) => {
  const { user } = useAuth();
  const messagesEndRef = useRef(null);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!selectedConversation) {
    return null;
  }

  console.log("selected conversation", selectedConversation);

  return (
    <>
      <div className={styles.chatHeader}>
        <h2 className={styles.chatName} onClick={()=>setShowGroupMembers(true)}>
          {selectedConversation.isGroup 
            ? selectedConversation.conversationName 
            : selectedConversation.participants?.find(p => p._id !== user._id)?.username || 'Unknown User'
          }
        </h2>
        {/* {selectedConversation.isGroup && (
          <span className={styles.groupInfo} onClick={()=>setShowGroupMembers(true)}>
            {selectedConversation.participants?.length || 0} members
          </span>
        )} */}
      </div>
      
      <div className={styles.messagesArea}>
        {Array.isArray(messages) && messages.map((msg) => (
          <div key={msg._id} className={`${styles.message} ${msg.sender._id === user?._id ? styles.ownMessage : styles.otherMessage}`}>
            <div className={styles.messageContent}>
              <div className={styles.messageBubble}>
                <p>{msg.content}</p>
                <span className={styles.messageTime}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className={styles.messageAvatar}>
                {msg.sender?.avatar ? (
                  <img 
                    src={msg.sender.avatar} 
                    alt={msg.sender.username} 
                    onError={(e) => e.target.style.display = 'none'}
                  />
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </>
  );
};

export default MessageList;
