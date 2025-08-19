import React, { useState } from 'react';

export default function SimpleApp() {
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #059669 100%)',
      color: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <header style={{
        background: 'rgba(30, 58, 138, 0.8)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(99, 102, 241, 0.3)',
        padding: '16px'
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              background: '#f97316',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ color: 'white', fontWeight: 'bold', fontSize: '18px' }}>T</span>
            </div>
            <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'white' }}>TradeScout</span>
          </div>
          <button 
            onClick={() => setShowAuthModal(true)}
            style={{
              background: '#f97316',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => (e.target as HTMLButtonElement).style.background = '#ea580c'}
            onMouseOut={(e) => (e.target as HTMLButtonElement).style.background = '#f97316'}
          >
            Get Started
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '64px 16px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{
              fontSize: '48px',
              fontWeight: 'bold',
              background: 'linear-gradient(to right, #ffffff, #d1d5db)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '16px',
              lineHeight: '1.1'
            }}>
              Find Trusted Local Contractors
            </h1>
            <p style={{
              fontSize: '20px',
              color: '#d1d5db',
              maxWidth: '672px',
              margin: '0 auto'
            }}>
              Connect with verified contractors in your area. Get up to 3 free quotes for your home improvement projects.
            </p>
          </div>

          {/* Quick Actions */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px',
            marginTop: '48px'
          }}>
            <div style={{
              background: 'rgba(30, 58, 138, 0.5)',
              padding: '24px',
              borderRadius: '8px',
              border: '1px solid rgba(99, 102, 241, 0.3)'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: '#3b82f6',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <span style={{ fontSize: '24px' }}>🔍</span>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Find Contractors</h3>
              <p style={{ color: '#9ca3af' }}>Browse verified contractors in your area</p>
            </div>
            
            <div style={{
              background: 'rgba(30, 58, 138, 0.5)',
              padding: '24px',
              borderRadius: '8px',
              border: '1px solid rgba(99, 102, 241, 0.3)'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: '#10b981',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <span style={{ fontSize: '24px' }}>💬</span>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Get Quotes</h3>
              <p style={{ color: '#9ca3af' }}>Receive up to 3 free project quotes</p>
            </div>
            
            <div style={{
              background: 'rgba(30, 58, 138, 0.5)',
              padding: '24px',
              borderRadius: '8px',
              border: '1px solid rgba(99, 102, 241, 0.3)'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: '#8b5cf6',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <span style={{ fontSize: '24px' }}>⭐</span>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Choose & Review</h3>
              <p style={{ color: '#9ca3af' }}>Select the best contractor and leave reviews</p>
            </div>
          </div>

          {/* Call to Action */}
          <div style={{ paddingTop: '32px' }}>
            <button 
              onClick={() => setShowAuthModal(true)}
              style={{
                background: '#f97316',
                color: 'white',
                border: 'none',
                padding: '16px 32px',
                borderRadius: '8px',
                fontSize: '18px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => (e.target as HTMLButtonElement).style.background = '#ea580c'}
              onMouseOut={(e) => (e.target as HTMLButtonElement).style.background = '#f97316'}
            >
              Start Your Project Today
            </button>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section style={{
        background: 'rgba(30, 58, 138, 0.3)',
        padding: '64px 0',
        marginTop: '64px'
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 16px' }}>
          <h2 style={{
            fontSize: '36px',
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: '48px'
          }}>
            Why Choose TradeScout?
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '32px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '64px',
                height: '64px',
                background: '#3b82f6',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <span style={{ fontSize: '32px' }}>✓</span>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Verified Contractors</h3>
              <p style={{ color: '#9ca3af' }}>All contractors are background checked and verified</p>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '64px',
                height: '64px',
                background: '#10b981',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <span style={{ fontSize: '32px' }}>💰</span>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Free Quotes</h3>
              <p style={{ color: '#9ca3af' }}>Get up to 3 free quotes with no obligations</p>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '64px',
                height: '64px',
                background: '#8b5cf6',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <span style={{ fontSize: '32px' }}>🛡️</span>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Insured Work</h3>
              <p style={{ color: '#9ca3af' }}>All work is covered by contractor insurance</p>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '64px',
                height: '64px',
                background: '#f97316',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <span style={{ fontSize: '32px' }}>⭐</span>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Quality Reviews</h3>
              <p style={{ color: '#9ca3af' }}>Read real reviews from verified customers</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        background: '#1e2732',
        padding: '32px 0',
        marginTop: '64px'
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 16px',
          textAlign: 'center'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '16px'
          }}>
            <div style={{
              width: '24px',
              height: '24px',
              background: '#f97316',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ color: 'white', fontWeight: 'bold', fontSize: '14px' }}>T</span>
            </div>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>TradeScout</span>
          </div>
          <p style={{ color: '#9ca3af' }}>© 2025 TradeScout. Connecting homeowners with trusted contractors.</p>
        </div>
      </footer>

      {/* Auth Modal */}
      {showAuthModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#1e3a8a',
            padding: '32px',
            borderRadius: '12px',
            maxWidth: '400px',
            width: '90%',
            textAlign: 'center'
          }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>Welcome to TradeScout</h2>
            <p style={{ color: '#d1d5db', marginBottom: '24px' }}>
              Ready to connect with trusted contractors? Login or create your account to get started.
            </p>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <button style={{
                flex: 1,
                background: '#f97316',
                color: 'white',
                border: 'none',
                padding: '12px',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer'
              }}>
                Login
              </button>
              <button style={{
                flex: 1,
                background: 'transparent',
                color: 'white',
                border: '2px solid #f97316',
                padding: '12px',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer'
              }}>
                Sign Up
              </button>
            </div>
            <button 
              onClick={() => setShowAuthModal(false)}
              style={{
                background: 'transparent',
                color: '#9ca3af',
                border: 'none',
                padding: '8px',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}