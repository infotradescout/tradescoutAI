import React from 'react';

// Simple test component to verify React is working
export default function TestApp() {
  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#1a1a2e',
      color: 'white',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <h1 style={{ color: '#ff6b35', marginBottom: '20px' }}>🔧 TradeScout Test Page</h1>
      <p style={{ marginBottom: '20px', textAlign: 'center' }}>
        If you can see this page, React and Vite are working correctly!
      </p>
      <div style={{ 
        backgroundColor: '#0f0f23', 
        padding: '15px', 
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <p><strong>✅ React is loaded</strong></p>
        <p><strong>✅ Vite dev server is running</strong></p>
        <p><strong>✅ JavaScript execution working</strong></p>
      </div>
      <button 
        onClick={() => alert('Button clicked! JavaScript events working.')}
        style={{
          backgroundColor: '#ff6b35',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '5px',
          cursor: 'pointer',
          fontSize: '16px'
        }}
      >
        Test Button
      </button>
      <p style={{ marginTop: '20px', fontSize: '14px', opacity: '0.7' }}>
        Current time: {new Date().toLocaleString()}
      </p>
    </div>
  );
}