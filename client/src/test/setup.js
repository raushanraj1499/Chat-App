import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import toast from 'react-hot-toast';

afterEach(() => {
  cleanup();
  toast.remove();
});
Element.prototype.scrollIntoView = () => {};
window.matchMedia = (media) => ({
  matches: false, media, onchange: null,
  addListener() {}, removeListener() {},
  addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
});
