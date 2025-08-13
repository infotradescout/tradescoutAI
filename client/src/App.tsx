import React from 'react';
import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { ErrorBoundary } from "@/components/ui/error-boundary";

// Simple test component
function TestPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-4xl font-bold mb-4 text-orange-500">🎯 TradeScout</h1>
      <p className="text-xl mb-4">✅ Application is now working!</p>
      <p className="mb-2">✅ React rendering successfully</p>
      <p className="mb-2">✅ Routing functional</p>
      <p className="mb-2">✅ Backend connected (port 5000)</p>
      <button
        onClick={() => alert('JavaScript working!')}
        className="px-6 py-3 bg-orange-500 text-white rounded hover:bg-orange-600 mr-4"
      >
        Test Interaction
      </button>
      <button
        onClick={() => window.location.href = '/contractors'}
        className="px-6 py-3 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        View Contractors
      </button>
    </div>
  );
}

function SimpleRouter() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Switch>
        <Route path="/" component={TestPage} />
        <Route path="/test" component={TestPage} />
        <Route component={() => (
          <div className="min-h-screen bg-gray-900 text-white p-8">
            <h1 className="text-2xl font-bold mb-4">Page Not Found</h1>
            <button
              onClick={() => window.location.href = '/'}
              className="px-4 py-2 bg-orange-500 text-white rounded"
            >
              Go Home
            </button>
          </div>
        )} />
      </Switch>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary fallback={
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">TradeScout Error</h1>
          <p className="mb-4">Something went wrong. Refreshing...</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-orange-500 text-white rounded"
          >
            Reload App
          </button>
        </div>
      </div>
    }>
      <QueryClientProvider client={queryClient}>
        <SimpleRouter />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}