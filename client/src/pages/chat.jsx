import React, { useState, useRef, useEffect } from "react";
import styles from '../styles/chat.module.css';
import Sidebar from "../components/Sidebar.jsx";
import ChatHeader from "../components/ChatHeader.jsx";
import ChatList from "../components/ChatList.jsx";
import MessageList from "../components/MessageList.jsx";
import NoChatSelected from "../components/NoChatSelected.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import ProfileModal from "../modals/profileModal.jsx";
import AddGroupModal from "../modals/addGroupModal.jsx";
import axios from "axios";
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from "../context/AuthContext.jsx";
import { useConversation } from "../context/ConversationContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { useNavigate } from "react-router-dom";
import GroupMembersListModal from "../modals/GroupMembersListModal.jsx";

const Chat = () => {
  const { user, loading } = useAuth();
  const { socket } = useSocket();
  if (loading || !socket) {
    return <LoadingSpinner />;
  }
  const {
    selectedConversation,
    setSelectedConversation,
    conversations,
    setConversations,
    messages,
    setMessages
  } = useConversation();

  axios.defaults.withCredentials = true

  const navigate = useNavigate();
  const [inputMessage, setInputMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showGroupMembers, setShowGroupMembers] = useState(false);


  useEffect(() => {
    const handleNewMessage = (message) => {
      console.log("hi new message received")
      console.log("Message received from server via socket:", message);

      // Add the new message to the messages state if it's for the current conversation
      if (selectedConversation && selectedConversation._id === message.conversation) {
        setMessages(prevMessages => [...prevMessages, message]);
      }

      // Update the conversation's latest message in the conversations list
      setConversations(prevConversations =>
        prevConversations.map(conv =>
          conv._id === message.conversation
            ? { ...conv, latestMessage: message, updatedAt: new Date() }
            : conv
        )
      );
    }

    socket.on("new message", handleNewMessage);

    return () => {
      socket.off("new message", handleNewMessage);
    }
  }, [socket, selectedConversation, setMessages, setConversations])

  useEffect(() => {
    if (!socket) return;

    const handleTyping = () => console.log("User typing...");
    const handleStopTyping = () => console.log("User stopped typing.");

    socket.on("typing", handleTyping);
    socket.on("stop typing", handleStopTyping);

    return () => {
      socket.off("typing", handleTyping);
      socket.off("stop typing", handleStopTyping);
    };
  }, [socket]);


  // Fetch conversations on mount
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const { data } = await axios.get('/api/conversation');
        console.log("Fetched conversations:", data.conversations);
        setConversations(data.conversations);
      } catch (err) {
        toast.error(err.response?.data?.message);
      }
    };

    fetchConversations();
  }, [setConversations]);


  // Fetch messages when conversation changes
  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedConversation) return;

      try {
        const { data } = await axios.get(`/api/message/${selectedConversation._id}`);
        setMessages(data.messages);

        socket.emit("join chat", selectedConversation._id);
      } catch (error) {
        toast.error(error.response?.data?.message);
      }
    };

    fetchMessages();
  }, [selectedConversation, setMessages, socket]);

  // Start a conversation with a user
  const startConversation = async (selectedUser) => {
    console.log("All conversations:", conversations);

    const existingConversation = conversations.find(conv =>
      !conv.isGroup && conv.participants.some(p => p._id === selectedUser._id)
    );

    console.log("Existing conversation found:", existingConversation);

    if (existingConversation) {
      setSelectedConversation(existingConversation);
    } else {
      try {
        const { data } = await axios.post('/api/conversation', {
          participants: [selectedUser._id]
        });

        const newConversation = data.conversation;
        setConversations([newConversation, ...conversations]);
        setSelectedConversation(newConversation);
      } catch (error) {
        toast.error(error.response?.data?.message || "Something went wrong");
      }
    }

    setSearchTerm('');
    setSearchResults([]);
    setShowSearchResults(false);
  };

  useEffect(() => {
    console.log("Updated selectedConversation:", selectedConversation);
  }, [selectedConversation]);

  // Send message handler
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputMessage.trim() || !selectedConversation) return;

    socket.emit("stop typing", selectedConversation._id);
    try {
      const { data } = await axios.post(`/api/message/${selectedConversation._id}`, { content: inputMessage });
      console.log("Send message response:", data);
      const newMessage = data.data;

      setMessages(prevMessages => [...prevMessages, newMessage]);
      setInputMessage('');

      setSelectedConversation(prev => ({
        ...prev,
        latestMessage: newMessage
      }));

      if (setConversations) {
        setConversations(prevConversations => 
          prevConversations.map(conv => 
            conv._id === selectedConversation._id 
              ? { ...conv, latestMessage: newMessage }
              : conv
          )
        );
      }

      socket.emit("new message", newMessage);
    } catch (error) {
      console.error("Send message error:", error);
      toast.error(error.response?.data?.message);
    }
  };


  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={styles.appContainer}>
      <Toaster position="top-right" />
      <Sidebar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />

      <div className={styles.mainContent}>
        <ChatHeader
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          searchResults={searchResults}
          setSearchResults={setSearchResults}
          showSearchResults={showSearchResults}
          setShowSearchResults={setShowSearchResults}
          startConversation={startConversation}
          profileOpen={profileOpen}
          setProfileOpen={setProfileOpen}
        />

        <div className={styles.main}>
          <main className={styles.chatSection}>
            {selectedConversation ? (
              <>
                <MessageList
                  messages={messages}
                  selectedConversation={selectedConversation}
                  setShowGroupMembers={setShowGroupMembers}
                />

                <form onSubmit={handleSendMessage} className={styles.messageInputArea}>
                  <input
                    type="text"
                    placeholder="Write your message"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className={styles.messageInput}
                  />
                  <button type="submit" className={styles.sendButton}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  </button>
                </form>
              </>
            ) : (
              <NoChatSelected />
            )}
          </main>

          <ChatList
            conversations={conversations}
            selectedConversation={selectedConversation}
            setSelectedConversation={setSelectedConversation}
            setGroupModalOpen={setGroupModalOpen}
          />
        </div>

        <ProfileModal
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          username={user.username}
          email={user.email}
          avatar={user.avatar}
        />

        <AddGroupModal
          open={groupModalOpen}
          onClose={() => setGroupModalOpen(false)}
        />

        <GroupMembersListModal
          selectedConversation={selectedConversation}
          open={showGroupMembers}
          onClose={() => setShowGroupMembers(false)}
        />
      </div>
    </div>
  );
};

export default Chat;
