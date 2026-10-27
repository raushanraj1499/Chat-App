import { useEffect, useRef } from 'react';
import styles from '../styles/chat.module.css';

export default function Modal({ title, children, onClose, pending = false }) {
  const card = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    card.current?.querySelector('button, input')?.focus();
    return () => previous?.focus();
  }, []);
  const onKeyDown = event => {
    if (event.key === 'Escape' && !pending) onClose();
    if (event.key !== 'Tab') return;
    const controls = [...card.current.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex="0"]')];
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  return <div className={styles.modalBackdrop} onKeyDown={onKeyDown}>
    <section ref={card} className={styles.modalCard} role="dialog" aria-modal="true" aria-label={title} aria-busy={pending}>
      <div className={styles.modalHeading}><h2>{title}</h2><button onClick={onClose} disabled={pending} aria-label="Close dialog">×</button></div>
      {children}
    </section>
  </div>;
}
