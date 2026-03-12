import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Handle global errors
window.addEventListener('error', (event) => {
  // Suppress ResizeObserver loop errors
  if (event.message?.includes('ResizeObserver loop')) {
    event.stopImmediatePropagation();
    return;
  }

  if (event.message?.includes('QuotaExceededError') || event.error?.name === 'QuotaExceededError') {
    console.error('LocalStorage quota exceeded. Clearing large data...');
    // We don't clear everything immediately to avoid losing work, 
    // but we alert the user that they should use the Reset button or delete some nodes.
    alert("Storage limit reached! Please delete some nodes or use the 'Reset' button in the header to clear space. Large images are no longer being saved to prevent this.");
  }
}, true);

window.addEventListener('unhandledrejection', (event) => {
  const message = event.reason?.message || String(event.reason);
  
  // Suppress ResizeObserver loop errors
  if (message.includes('ResizeObserver loop')) {
    event.stopImmediatePropagation();
    event.preventDefault();
    return;
  }

  // Suppress Vite/HMR websocket errors
  if (message.includes('WebSocket closed without opened') || message.includes('failed to connect to websocket')) {
    event.stopImmediatePropagation();
    event.preventDefault();
    return;
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
