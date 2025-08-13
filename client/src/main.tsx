
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#1a1a2e', 
      color: '#fff', 
      padding: '2rem',
      fontFamily: 'Arial, sans-serif',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column'
    }}>
      <h1 style={{ fontSize: '4rem', marginBottom: '1rem', color: '#f97316' }}>
        🎯 TradeScout
      </h1>
      <p style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
        Application is now loading successfully!
      </p>
      <button 
        style={{
          backgroundColor: '#f97316',
          color: 'white',
          padding: '1rem 2rem',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '1.1rem',
          marginTop: '1rem'
        }}
        onClick={() => window.location.href = '/test'}
      >
        Go to Full App
      </button>
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
