import React from 'react';
import styles from '../styles/sidebar.module.css';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
  const location = useLocation();
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>360Link</div>
      <nav className={styles.navLinks}>
        <Link to="/dashboard" className={location.pathname === '/dashboard' ? styles.active : ''}>Dashboard</Link>
        <Link to="/chat" className={location.pathname === '/chat' ? styles.active : ''}>Chat</Link>
      </nav>
      <div className={styles.footer}>All rights reserved</div>
    </aside>
  );
};

export default Sidebar;