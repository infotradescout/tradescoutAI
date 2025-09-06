console.log('=== MAIN.TSX LOADING ===');
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
console.log('=== IMPORTS COMPLETE ===');

// Add global error handling
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

console.log('=== ATTEMPTING TO CREATE ROOT ===');
const rootElement = document.getElementById('root');
console.log('Root element:', rootElement);

if (!rootElement) {
  console.error('ROOT ELEMENT NOT FOUND!');
} else {
  console.log('=== CREATING REACT ROOT ===');
  const root = ReactDOM.createRoot(rootElement);
  console.log('=== RENDERING APP ===');
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log('=== RENDER COMPLETE ===');
}