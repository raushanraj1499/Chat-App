import React, { useState, useEffect } from 'react';
import useDebounce from '../hooks/useDebounce.js';
import axios from 'axios';
import { useConversation } from '../context/ConversationContext.jsx';

const AddGroupModal = ({ open, onClose }) => {
  const [groupName, setGroupName] = useState('');
  const [search, setSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const {conversations, setConversations} = useConversation();

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      setGroupName('');
      setSearch('');
      setSelectedUsers([]);
      setSearchResults([]);
    }
  }, [open]);

  const debouncedSearch = useDebounce(search, 1000);
  
  useEffect(() => {
    const searchUsers = async () => {
      if (debouncedSearch.trim().length < 2) {
        setSearchResults([]);
        return;
      }
  
      setLoading(true);
      try {
        const response = await axios.get(`/api/user/search?q=${encodeURIComponent(debouncedSearch.trim())}`);
        setSearchResults(response.data.users || []);
      } catch (error) {
        console.error('Error searching users:', error);
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    };

    searchUsers();
  }, [debouncedSearch]);

  // Toggle user selection
  const toggleUserSelection = (user) => {
    setSelectedUsers(prev => {
      const isSelected = prev.find(u => u._id === user._id);
      if (isSelected) {
        return prev.filter(u => u._id !== user._id);
      } else {
        return [...prev, user];
      }
    });
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      alert('Please enter a group name');
      return;
    }
    if (selectedUsers.length === 0) {
      alert('Please select at least one user');
      return;
    }
  
    setCreating(true);
    try {
      const participantIds = selectedUsers.map(user => user._id);
      
      const response = await axios.post('/api/conversation/group', {
        conversationName: groupName.trim(),
        participants: participantIds
      });
  
      console.log('Group created:', response.data);
   
      const newGroup = response.data.conversation;
   
      setConversations(prev => [newGroup, ...prev]);
      
      // Reset form and close modal
      setGroupName('');
      setSelectedUsers([]);
      setSearch('');
      setSearchResults([]);
      onClose();
      
    } catch (error) {
      console.error('Error creating group:', error);
      alert(error.response?.data?.message || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  // Get initials for avatar fallback
  const getInitials = (name) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  if (!open) return null;

  return (
    <div style={modalStyle}>
      <div style={cardStyle}>
        <button style={closeStyle} onClick={onClose} aria-label="Close">&times;</button>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 400, marginBottom: 18, textAlign: 'left' }}>Create Group Chat</h1>
        
        <input
          style={inputStyle}
          type="text"
          placeholder="Chat Name"
          value={groupName}
          onChange={e => setGroupName(e.target.value)}
        />
        
        <input
          style={{ ...inputStyle, borderColor: '#2584e6' }}
          type="text"
          placeholder="Search users by username..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {/* Selected Users */}
        {selectedUsers.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '1rem', fontWeight: 500, marginBottom: 8, color: '#2584e6' }}>
              Selected ({selectedUsers.length}):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {selectedUsers.map(user => (
                <div key={user._id} style={{
                  background: '#2584e6',
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: 16,
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  {user.username}
                  <button
                    onClick={() => toggleUserSelection(user)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      padding: 0,
                      marginLeft: 4
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search Results */}
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {loading && <div style={{ textAlign: 'center', padding: 20 }}>Searching...</div>}
          
          {!loading && search.trim().length >= 2 && searchResults.length === 0 && (
            <div style={{ textAlign: 'center', padding: 20, color: '#666' }}>
              No users found
            </div>
          )}

          {searchResults.map((user) => {
            const isSelected = selectedUsers.find(u => u._id === user._id);
            return (
              <div 
                key={user._id} 
                style={{
                  ...userCardStyle,
                  background: isSelected ? '#e3f2fd' : '#ededed',
                  border: isSelected ? '2px solid #2584e6' : '2px solid transparent',
                  cursor: 'pointer'
                }}
                onClick={() => toggleUserSelection(user)}
              >
                {user.avatar ? (
                  <img src={user.avatar} alt={user.username} style={avatarStyle} />
                ) : (
                  <div style={{ 
                    ...avatarStyle, 
                    background: isSelected ? '#2584e6' : '#e74c3c', 
                    color: '#fff', 
                    justifyContent: 'center' 
                  }}>
                    {getInitials(user.username)}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={nameStyle}>{user.username}</div>
                  <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 2 }}>
                    Email: <span style={emailStyle}>{user.email}</span>
                  </div>
                </div>
                {isSelected && (
                  <div style={{ color: '#2584e6', fontSize: '1.2rem', fontWeight: 'bold' }}>
                    ✓
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button 
          style={{
            ...buttonStyle,
            background: creating ? '#ccc' : '#2584e6',
            cursor: creating ? 'not-allowed' : 'pointer'
          }} 
          onClick={handleCreateGroup}
          disabled={creating}
        >
          {creating ? 'Creating...' : 'Create Chat'}
        </button>
      </div>
    </div>
  );
};

// Styles (same as before)
const modalStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  background: 'rgba(0,0,0,0.15)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const cardStyle = {
  background: '#fff',
  borderRadius: '12px',
  padding: '40px 32px 32px 32px',
  minWidth: 400,
  maxWidth: 480,
  boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
  textAlign: 'left',
  position: 'relative',
};

const closeStyle = {
  position: 'absolute',
  top: 18,
  right: 18,
  fontSize: 28,
  color: '#444',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
};

const inputStyle = {
  width: '100%',
  fontSize: '1.2rem',
  padding: '12px 16px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  marginBottom: 16,
  marginTop: 8,
  boxSizing: 'border-box',
};

const userCardStyle = {
  display: 'flex',
  alignItems: 'center',
  background: '#ededed',
  borderRadius: 12,
  padding: '12px 18px',
  marginBottom: 14,
  gap: 18,
};

const avatarStyle = {
  width: 48,
  height: 48,
  borderRadius: '50%',
  objectFit: 'cover',
  background: '#f5f5f5',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 600,
  fontSize: 22,
  color: '#fff',
  marginRight: 16,
};

const nameStyle = {
  fontSize: '1.2rem',
  fontWeight: 500,
  marginBottom: 2,
};

const emailStyle = {
  fontSize: '1rem',
  color: '#222',
  margin: 0,
};

const buttonStyle = {
  marginTop: 24,
  padding: '12px 32px',
  fontSize: '1.1rem',
  borderRadius: 8,
  border: 'none',
  background: '#2584e6',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 500,
  float: 'right',
};

export default AddGroupModal;
