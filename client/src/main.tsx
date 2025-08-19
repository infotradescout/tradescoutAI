import React from 'react';
import ReactDOM from 'react-dom/client';
import SimpleApp from './simple-app.tsx';
import './index.css';

// Global error handling
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

// Use simple app to avoid React hook conflicts
root.render(
  <React.StrictMode>
    <SimpleApp />
  </React.StrictMode>
);