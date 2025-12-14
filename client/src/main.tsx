import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Global error handling (keep this)
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root container missing in index.html');
}

const root = ReactDOM.createRoot(container);

// IMPORTANT:
// Do NOT wrap App in React.StrictMode here.
// StrictMode intentionally double-mounts in dev,
// which was breaking Scout, animations, and OAuth.
root.render(<App />);
