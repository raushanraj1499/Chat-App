import { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { mergeMessages } from '../lib/messages.js';

const ConversationContext = createContext();

export const ConversationProvider = ({ children }) => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState({});
  const { user, setUser} = useAuth();
  const addMessages = useCallback((conversationId, incoming) => {
    setMessages(previous => ({
      ...previous,
      [conversationId]: mergeMessages(previous[conversationId], incoming),
    }));
  }, []);

  return (
    <ConversationContext.Provider value={{
        conversations,
        setConversations,
        selectedConversation,
        setSelectedConversation,
        messages,
        setMessages,
        addMessages,
        user,
        setUser
    }}>
      {children}
    </ConversationContext.Provider>
  );
};

export const useConversation = () => useContext(ConversationContext);
