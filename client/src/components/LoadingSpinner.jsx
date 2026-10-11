import React from 'react';
import styles from '../styles/spinner.module.css'; 

const LoadingSpinner = () => {
  return (
    <div className={styles.spinnerContainer} role="status" aria-label="Loading session">
      <div className={styles.spinner}></div>
    </div>
  );
};

export default LoadingSpinner;
