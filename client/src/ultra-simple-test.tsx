import React from 'react';

export default function UltraSimpleTest() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#000', 
      color: '#fff', 
      padding: '2rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column'
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>
        React Mount Test
      </h1>
      <p style={{ fontSize: '1.5rem' }}>
        If you see this, React is mounting properly!
      </p>
      <div style={{ 
        backgroundColor: '#333', 
        padding: '1rem', 
        borderRadius: '8px',
        marginTop: '2rem'
      }}>
        Current time: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
}