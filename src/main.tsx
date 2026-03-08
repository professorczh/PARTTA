import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Handle localStorage quota exceeded errors globally
window.addEventListener('error', (event) => {
  if (event.message?.includes('QuotaExceededError') || event.error?.name === 'QuotaExceededError') {
    console.error('LocalStorage quota exceeded. Clearing large data...');
    // We don't clear everything immediately to avoid losing work, 
    // but we alert the user that they should use the Reset button or delete some nodes.
    alert("Storage limit reached! Please delete some nodes or use the 'Reset' button in the header to clear space. Large images are no longer being saved to prevent this.");
  }
}, true);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
