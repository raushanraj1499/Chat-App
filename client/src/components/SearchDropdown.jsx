import React from 'react';
import styles from '../styles/chat.module.css';

const SearchDropdown = ({ 
  showSearchResults, 
  searchResults, 
  startConversation 
}) => {
  if (!showSearchResults || searchResults.length === 0) {
    return null;
  }

  return (
    <div className={styles.searchResults}>
      {searchResults.map(user => (
        <div 
          key={user._id} 
          className={styles.searchResultItem}
          onClick={() => startConversation(user)}
        >
          {user.avatar ? (
            <img src={user.avatar} alt={user.username} className={styles.resultAvatar} />
          ) : (
            <div className={styles.resultAvatarPlaceholder}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
          )}
          <div className={styles.resultInfo}>
            <span className={styles.resultName}>{user.username}</span>
            <span className={styles.resultEmail}>{user.email}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SearchDropdown;
