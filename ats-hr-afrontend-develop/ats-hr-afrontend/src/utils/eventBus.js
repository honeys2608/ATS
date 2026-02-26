// src/utils/eventBus.js
// tiny wrapper over window CustomEvent for cross-component pub/sub

const emit = (name, detail = {}) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
};

const on = (name, handler) => {
  if (typeof window === 'undefined') return () => {};
  // handler will receive the event object; typical usage: (e) => { /* e.detail */ }
  window.addEventListener(name, handler);
  return () => window.removeEventListener(name, handler);
};

export default { emit, on };
