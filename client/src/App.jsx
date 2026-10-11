import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/login.jsx';
import Chat from './pages/chat.jsx';
import Signup from './pages/signup.jsx';
import NotFound from './pages/notFound.jsx';
import './App.css';
import SessionRoute from './components/SessionRoute.jsx';


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SessionRoute home />} />
        <Route element={<SessionRoute guestOnly />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Route>
        <Route element={<SessionRoute />}>
          <Route path="/chat" element={<Chat />} />
        </Route>
        <Route path="*" element={<NotFound/>} />
      </Routes>
      
      <Toaster
        position="top-right"
        gutter={8}
        containerStyle={{ margin: "8px" }}
        toastOptions={{
          duration: 3000,
          style: {
            fontSize: "14px",
            padding: "16px 24px",
            backgroundColor: "#1e293b",
            color: "#f8fafc",
          },
          success: {
            iconTheme: {
              primary: "#4ade80",
              secondary: "#f8fafc",
            },
          },
          error: {
            iconTheme: {
              primary: "#f87171",
              secondary: "#f8fafc",
            },
          },
        }}
      />
    </BrowserRouter>
  );
}

export default App;
