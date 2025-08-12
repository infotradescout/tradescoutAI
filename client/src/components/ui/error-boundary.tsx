import React, { Component, ErrorInfo, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for debugging
    console.warn('Error boundary caught an error:', error, errorInfo);

    // Don't log hook call errors in production as they're expected during development
    if (!error.message.includes('Invalid hook call')) {
      console.error('Error boundary caught an error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Return fallback UI or empty div
      return this.props.fallback || <div className="error-boundary-fallback"></div>;
    }

    return this.props.children;
  }
}