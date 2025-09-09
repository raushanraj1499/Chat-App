// index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { ConversationProvider } from './context/ConversationContext.jsx';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <SocketProvider>
        <ConversationProvider>
          <App />
        </ConversationProvider>
      </SocketProvider>
    </AuthProvider>
  </React.StrictMode>
);