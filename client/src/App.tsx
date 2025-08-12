import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import { ErrorBoundary } from "./components/ui/error-boundary";
import React from "react";
import { queryClient } from "./lib/queryClient";
import MinimalRouter from './MinimalRouter';

export default function App() {
  return (
    <ErrorBoundary fallback={<div className="min-h-screen gradient-bg flex items-center justify-center text-white">Loading...</div>}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <MinimalRouter />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}