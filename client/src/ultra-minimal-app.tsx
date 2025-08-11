import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Switch, Route } from "wouter";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const response = await fetch(queryKey[0] as string);
        if (!response.ok) {
          throw new Error(`${response.status}: ${response.statusText}`);
        }
        return response.json();
      },
      retry: false,
    },
  },
});

function SafeLanding() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(to bottom right, #1e3a8a, #0f172a)', 
      color: 'white',
      padding: '4rem 2rem',
      textAlign: 'center'
    }}>
      <h1 style={{ 
        fontSize: '4rem', 
        fontWeight: 'bold', 
        marginBottom: '2rem',
        background: 'linear-gradient(to right, #fb923c, #ea580c)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent'
      }}>
        TradeScout Social Platform
      </h1>
      
      <p style={{ fontSize: '1.5rem', marginBottom: '3rem', color: '#d1d5db' }}>
        Connect with your community, find trusted contractors, and build lasting relationships
      </p>
      
      <div style={{ marginBottom: '3rem', display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <div style={{ 
          background: 'rgba(30, 41, 59, 0.5)', 
          padding: '2rem', 
          borderRadius: '0.5rem', 
          border: '1px solid #374151',
          minWidth: '250px'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏠</div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>Community Feed</h3>
          <p style={{ color: '#9ca3af' }}>Share updates, ask questions, and connect with neighbors</p>
        </div>
        
        <div style={{ 
          background: 'rgba(30, 41, 59, 0.5)', 
          padding: '2rem', 
          borderRadius: '0.5rem', 
          border: '1px solid #374151',
          minWidth: '250px'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔨</div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>Find Contractors</h3>
          <p style={{ color: '#9ca3af' }}>Discover verified local contractors for your projects</p>
        </div>
        
        <div style={{ 
          background: 'rgba(30, 41, 59, 0.5)', 
          padding: '2rem', 
          borderRadius: '0.5rem', 
          border: '1px solid #374151',
          minWidth: '250px'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>Marketplace</h3>
          <p style={{ color: '#9ca3af' }}>Buy, sell, and trade with your community</p>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <a 
          href="/login" 
          style={{ 
            display: 'inline-block',
            background: '#ea580c', 
            color: 'white', 
            padding: '0.75rem 2rem', 
            borderRadius: '0.5rem', 
            fontWeight: '600', 
            textDecoration: 'none',
            transition: 'background-color 0.2s'
          }}
        >
          Get Started
        </a>
        <a 
          href="/community" 
          style={{ 
            display: 'inline-block',
            border: '1px solid #ea580c', 
            color: '#ea580c', 
            padding: '0.75rem 2rem', 
            borderRadius: '0.5rem', 
            fontWeight: '600', 
            textDecoration: 'none',
            transition: 'all 0.2s'
          }}
        >
          Explore Community
        </a>
      </div>
    </div>
  );
}

function Login() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(to bottom right, #1e3a8a, #0f172a)', 
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{ 
        background: 'rgba(30, 41, 59, 0.8)', 
        padding: '3rem', 
        borderRadius: '1rem', 
        border: '1px solid #374151',
        maxWidth: '400px',
        width: '100%'
      }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '2rem', textAlign: 'center' }}>Login to TradeScout</h2>
        <p style={{ textAlign: 'center', color: '#9ca3af', marginBottom: '2rem' }}>
          Login functionality will be available once the full app is restored.
        </p>
        <a 
          href="/"
          style={{ 
            display: 'block',
            background: '#ea580c', 
            color: 'white', 
            padding: '0.75rem', 
            borderRadius: '0.5rem', 
            textAlign: 'center',
            textDecoration: 'none'
          }}
        >
          Back to Home
        </a>
      </div>
    </div>
  );
}

export default function UltraMinimalApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <Switch>
        <Route path="/" component={SafeLanding} />
        <Route path="/login" component={Login} />
        <Route>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <h1>Page Not Found</h1>
            <a href="/">Go Home</a>
          </div>
        </Route>
      </Switch>
    </QueryClientProvider>
  );
}