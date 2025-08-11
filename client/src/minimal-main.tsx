import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#000', 
      color: '#fff', 
      padding: '2rem',
      fontFamily: 'Arial, sans-serif',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column'
    }}>
      <h1 style={{ fontSize: '4rem', marginBottom: '1rem' }}>
        🎯 TradeScout Works!
      </h1>
      <p style={{ fontSize: '1.5rem' }}>
        React is successfully rendering.
      </p>
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} else {
  console.error('Root element not found');
}