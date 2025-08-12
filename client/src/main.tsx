import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Add error boundary for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // Prevent the default browser behavior
  event.preventDefault();
});

// Add memory monitoring and cleanup
let memoryCheckInterval: NodeJS.Timeout;

const monitorMemory = () => {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    const usedPercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
    
    if (usedPercent > 85) {
      console.warn('High memory usage detected:', usedPercent.toFixed(1) + '%');
      
      // Trigger garbage collection if available
      if ('gc' in window) {
        (window as any).gc();
      }
      
      // Clear query cache if memory is high
      if (usedPercent > 90) {
        import('./lib/queryClient').then(({ queryClient }) => {
          queryClient.clear();
          console.log('Query cache cleared due to high memory usage');
        });
      }
      
      // Force cleanup of unused components
      if (usedPercent > 95) {
        // Clear any component state that might be holding references
        window.dispatchEvent(new CustomEvent('lowMemory'));
      }
    }
  }
};

// Check memory every 15 seconds for better responsiveness
memoryCheckInterval = setInterval(monitorMemory, 15000);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (memoryCheckInterval) {
    clearInterval(memoryCheckInterval);
  }
});

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} else {
  console.error("Root element not found");
}