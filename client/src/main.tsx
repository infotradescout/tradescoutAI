import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import SimpleApp from './simple-app.tsx';
import './index.css';

// Add global error handling
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

// Use simplified app to ensure the preview works
root.render(
  <React.StrictMode>
    <SimpleApp />
  </React.StrictMode>
);