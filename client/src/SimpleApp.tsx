import React from 'react';

export default function SimpleApp() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom right, #1e3a8a, #0f172a)',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '2rem',
      padding: '2rem'
    }}>
      <h1 style={{ fontSize: '3rem', fontWeight: 'bold', textAlign: 'center' }}>
        TradeScout
      </h1>
      <p style={{ fontSize: '1.2rem', textAlign: 'center', maxWidth: '600px' }}>
        The contractor marketplace platform is loading successfully!
      </p>
      <div style={{
        background: 'rgba(255, 255, 255, 0.1)',
        padding: '1rem 2rem',
        borderRadius: '8px',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        Authentication system is operational
      </div>
    </div>
  );
}