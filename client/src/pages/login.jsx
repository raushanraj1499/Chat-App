import React, { useState, useRef } from 'react';
import api, { errorMessage } from '../lib/api.js';
import styles from '../styles/login.module.css'
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const {setUser} = useAuth();
  const submitting = useRef(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'email') setEmail(value);
    if (name === 'password') setPassword(value);
  };

  const submitHandler = async () => {
    if (submitting.current) return;
    if (!email || !password) {
        toast.error("Fill all the credentials")
        return;
    }
    submitting.current = true;
    setLoading(true);

    try {
      const config = {
        headers: {
          "Content-type": "application/json",
        },
      };
      const { data } = await api.post("/api/user/login",{ email, password }, { ...config, skipAuthExpiry: true });
      setUser(data.user);
      // toast.success(data.message);
      navigate('/chat', { replace: true });
    } catch (error) {
      toast.error(errorMessage(error, 'Unable to log in. Please try again.'));
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submitHandler();
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginCard}>
        <div className={styles.header}>
          <h1 className={styles.logo}>Chat-App</h1>
          <h2 className={styles.title}>Account Login</h2>
          <p className={styles.subtitle}>Enter your account info below:</p>
        </div>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="email" className={styles.label}>Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={handleChange}
              className={styles.input}
              placeholder="johndoe@chatapp.com"
              required
              disabled={loading}
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password" className={styles.label}>Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={handleChange}
              className={styles.input}
              placeholder="Case Sensitive"
              required
              disabled={loading}
            />
          </div>

          <button 
            type="submit" 
            className={`${styles.signInButton} ${loading ? styles.loading : ''}`}
            disabled={loading}
          >
            {loading ? 'Logging In...' : 'Log In'}
          </button>

          {/* <div className={styles.forgotPassword}>
            <a href="#" className={styles.forgotLink}>Forgot Password?</a>
          </div> */}
        </form>

        <div className={styles.footer}>
          <p className={styles.footerText}>
            Need an account? <a href="/signup" className={styles.createAccountLink}>Create student account.</a>
          </p>
        </div>
      </div>
      
      <div className={styles.bottomFooter}>
        <p className={styles.copyright}>
          All rights reserved@ <span className={styles.poweredBy}>Raushan</span>.
        </p>
      </div>
    </div>
  );
};

export default Login;
