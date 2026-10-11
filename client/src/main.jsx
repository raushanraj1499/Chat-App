// index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext.jsx';
import SessionProviders from './context/SessionProviders.jsx';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <SessionProviders><App /></SessionProviders>
    </AuthProvider>
  </React.StrictMode>
);
