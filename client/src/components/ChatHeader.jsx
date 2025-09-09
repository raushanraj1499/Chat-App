import React, { useState, useRef, useEffect } from 'react';
import styles from '../styles/chat.module.css';
import { useAuth } from '../context/AuthContext.jsx';
import { useConversation } from '../context/ConversationContext.jsx';
import axios from 'axios';
import toast from 'react-hot-toast';
import useDebounce from '../hooks/useDebounce.js';
import { useNavigate } from 'react-router-dom';

const ChatHeader = ({ 
  searchTerm, 
  setSearchTerm, 
  searchResults, 
  setSearchResults, 
  showSearchResults, 
  setShowSearchResults,
  startConversation ,
  profileOpen,
  setProfileOpen
}) => {
  const { user , setUser} = useAuth();
  const {setSelectedConversation, setMessages} = useConversation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const debouncedSearchTerm = useDebounce(searchTerm, 1000);
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Handle search for users
  useEffect(() => {
    const fetchUsers = async () => {
      if (!debouncedSearchTerm.trim()) {
        setSearchResults([]);
        return;
      }
  
      try {
        const config = {
          headers: { Authorization: `Bearer ${user.token}` }
        };
        const { data } = await axios.get(`/api/user/search?q=${debouncedSearchTerm}`, config);
        setSearchResults(data.users);
        setShowSearchResults(true);
      } catch (error) {
        toast.error("Failed to search user");
      }
    };

    fetchUsers();
  }, [debouncedSearchTerm, user.token, setSearchResults, setShowSearchResults]);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setShowSearchResults]);

  const handleLogout = async () => {
    try {
      await axios.post('/api/user/logout');
      setUser(null);
      setSelectedConversation(null);
      setMessages([]);

      navigate('/login');
    } catch (error) {
      toast.error("Something went wrong");
      return;
    }
    setDropdownOpen(false);
  };

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft} ref={searchRef}>
        <h1 className={styles.title}>Chat</h1>
        <div className={styles.searchContainer}>
          <div className={styles.searchBox}>
            <svg className={styles.searchIcon} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
            </svg>
            <input 
              type="text" 
              placeholder="Search for users"
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setShowSearchResults(true)}
            />
          </div>
          
          {showSearchResults && searchResults.length > 0 && (
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
          )}
        </div>
      </div>
      
      <div className={styles.headerRight}>
        <span className={styles.username}>{user?.username}</span>
        <button
          className={styles.avatar}
          onClick={() => setDropdownOpen(!dropdownOpen)}
          aria-label="User menu"
        >
          {user?.avatar ? (
            <img src={user.avatar} alt="Profile" className={styles.avatarImage} />
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          )}
        </button>
        
        {dropdownOpen && (
          <div ref={dropdownRef} className={styles.dropdownMenu}>
            <button 
              className={styles.dropdownItem}
              onClick={() => {
                setProfileOpen(true);
                setDropdownOpen(false);
              }}
            >
              My Profile
            </button>
            <button 
              className={styles.dropdownItem}
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default ChatHeader;
