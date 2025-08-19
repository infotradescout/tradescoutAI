import React from 'react';
import ReactDOM from 'react-dom/client';

// Test component first
const TestApp = () => {
  console.log('TestApp rendering...');
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e3a8a, #059669)',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
      textAlign: 'center'
    }}>
      <div style={{
        background: '#f97316',
        width: '64px',
        height: '64px',
        borderRadius: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '24px'
      }}>
        <span style={{ fontSize: '32px', fontWeight: 'bold' }}>T</span>
      </div>
      <h1 style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '16px' }}>
        TradeScout
      </h1>
      <p style={{ fontSize: '20px', color: '#d1d5db', marginBottom: '32px', maxWidth: '600px' }}>
        Find Trusted Local Contractors
      </p>
      <p style={{ fontSize: '16px', color: '#9ca3af' }}>
        React Successfully Mounted! ✓
      </p>
    </div>
  );
};

// Global error handling
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Wait for DOM to be ready
const initApp = () => {
  console.log('DOM ready, starting React app...');
  const rootElement = document.getElementById('root');
  console.log('Root element:', rootElement);

  if (rootElement) {
    try {
      // Clear any existing content
      rootElement.innerHTML = '';
      
      const root = ReactDOM.createRoot(rootElement);
      console.log('React root created successfully');
      
      root.render(React.createElement(TestApp));
      console.log('React app rendered successfully');
    } catch (error) {
      console.error('Error creating React app:', error);
      // Fallback to direct DOM manipulation
      rootElement.innerHTML = `
        <div style="min-height:100vh;background:linear-gradient(135deg,#1e3a8a,#059669);color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,sans-serif;text-align:center">
          <div style="background:#f97316;width:64px;height:64px;border-radius:16px;display:flex;align-items:center;justify-content:center;margin-bottom:24px">
            <span style="font-size:32px;font-weight:bold">T</span>
          </div>
          <h1 style="font-size:48px;font-weight:bold;margin-bottom:16px">TradeScout</h1>
          <p style="font-size:20px;color:#d1d5db;margin-bottom:32px">Find Trusted Local Contractors</p>
          <p style="font-size:16px;color:#9ca3af">Fallback Mode Active ⚠️</p>
        </div>
      `;
    }
  } else {
    console.error('Root element not found!');
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}