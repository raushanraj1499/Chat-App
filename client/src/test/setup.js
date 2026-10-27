import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import toast from 'react-hot-toast';

afterEach(() => {
  cleanup();
  toast.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
Element.prototype.scrollIntoView = () => {};
window.matchMedia = (media) => ({
  matches: false, media, onchange: null,
  addListener() {}, removeListener() {},
  addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
});
