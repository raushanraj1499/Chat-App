import React, { useEffect, useState } from 'react';

const GroupMembersListModal = ({ selectedConversation, open, onClose, currentUser }) => {
  const [participants, setParticipants] = useState([]);

  useEffect(() => {
    if (selectedConversation?.participants) {
      setParticipants(selectedConversation.participants);
    }
  }, [selectedConversation]);

  const getInitials = (name) => {
    if (!name) return '?';
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
        <button style={closeStyle} onClick={onClose} aria-label="Close">
          ×
        </button>
        
        <div style={headerStyle}>
          <h2 style={titleStyle}>Group Members</h2>
          <div style={groupInfoStyle}>
            <div style={groupNameStyle}>{selectedConversation?.conversationName || 'Group Chat'}</div>
            <div style={memberCountStyle}>
              {participants?.length || 0} member{participants?.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        <div style={membersContainerStyle}>
          {participants && participants.length > 0 ? (
            participants.map((member) => {
              const isAdmin = selectedConversation?.groupAdmin === member._id || 
                             selectedConversation?.groupAdmin?._id === member._id;
              const isCurrentUser = member._id === currentUser?._id;
              
              return (
                <div key={member._id} style={memberCardStyle}>
                  <div style={memberInfoStyle}>
                    {member.avatar ? (
                      <img src={member.avatar} alt={member.username} style={avatarStyle} />
                    ) : (
                      <div style={avatarFallbackStyle}>
                        {getInitials(member.username || member.name)}
                      </div>
                    )}
                    
                    <div style={memberDetailsStyle}>
                      <div style={memberNameStyle}>
                        {member.username || member.name}
                        {isCurrentUser && <span style={youTagStyle}>(You)</span>}
                      </div>
                      <div style={memberEmailStyle}>{member.email}</div>
                      {isAdmin && <div style={adminBadgeStyle}>Admin</div>}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={emptyStateStyle}>
              <div style={emptyTextStyle}>No members found</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Simple Styles
const modalStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  background: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const cardStyle = {
  background: '#fff',
  borderRadius: '8px',
  padding: '0',
  width: '450px',
  maxHeight: '80vh',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
};

const closeStyle = {
  position: 'absolute',
  top: '12px',
  right: '12px',
  width: '30px',
  height: '30px',
  borderRadius: '50%',
  background: '#f5f5f5',
  color: '#666',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '18px',
  zIndex: 10,
};

const headerStyle = {
  background: '#1c2940',
  padding: '20px',
  borderBottom: '1px solid #e9ecef',
  borderRadius: '8px 8px 0 0',
};

const titleStyle = {
  color : '#e9ecef',
  fontSize: '1.25rem',
  fontWeight: '600',
  margin: '0 0 12px 0',
};

const groupInfoStyle = {
  background: '#fff',
  padding: '12px',
  borderRadius: '6px',
  border: '1px solid #e9ecef',
};

const groupNameStyle = {
  fontSize: '1rem',
  fontWeight: '500',
  color: '#2c3e50',
  marginBottom: '4px',
};

const memberCountStyle = {
  fontSize: '0.875rem',
  color: '#666',
};

const membersContainerStyle = {
  flex: 1,
  overflowY: 'auto',
  padding: '16px',
};

const memberCardStyle = {
  display: 'flex',
  alignItems: 'center',
  padding: '12px',
  marginBottom: '8px',
  background: '#f8f9fa',
  borderRadius: '6px',
  border: '1px solid #e9ecef',
};

const memberInfoStyle = {
  display: 'flex',
  alignItems: 'center',
  flex: 1,
};

const avatarStyle = {
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  objectFit: 'cover',
  marginRight: '12px',
};

const avatarFallbackStyle = {
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  background: '#007bff',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: '600',
  fontSize: '0.875rem',
  marginRight: '12px',
};

const memberDetailsStyle = {
  flex: 1,
};

const memberNameStyle = {
  fontSize: '0.95rem',
  fontWeight: '500',
  color: '#333',
  marginBottom: '2px',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const memberEmailStyle = {
  fontSize: '0.8rem',
  color: '#666',
  marginBottom: '4px',
};

const youTagStyle = {
  fontSize: '0.75rem',
  color: '#007bff',
  fontWeight: '400',
};

const adminBadgeStyle = {
  fontSize: '0.7rem',
  background: '#28a745',
  color: '#fff',
  padding: '2px 6px',
  borderRadius: '4px',
  fontWeight: '500',
  display: 'inline-block',
};

const emptyStateStyle = {
  textAlign: 'center',
  padding: '40px 20px',
  color: '#666',
};

const emptyTextStyle = {
  fontSize: '1rem',
  color: '#666',
};

export default GroupMembersListModal;
