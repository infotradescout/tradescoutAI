export default function TestPage() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#000', 
      color: '#fff', 
      padding: '2rem',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>
        TradeScout Test Page
      </h1>
      <p style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>
        If you can see this, React is working properly!
      </p>
      <div style={{ 
        backgroundColor: '#333', 
        padding: '1rem', 
        borderRadius: '8px',
        marginBottom: '1rem'
      }}>
        <h2>System Status:</h2>
        <ul>
          <li>✅ React rendering</li>
          <li>✅ Basic styling</li>
          <li>✅ Component loading</li>
        </ul>
      </div>
      <button 
        style={{
          backgroundColor: '#f97316',
          color: 'white',
          padding: '1rem 2rem',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '1.1rem'
        }}
        onClick={() => alert('Button clicked!')}
      >
        Test Interaction
      </button>
    </div>
  );
}