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
    
    if (usedPercent > 90) {
      console.warn('High memory usage detected:', usedPercent.toFixed(1) + '%');
      
      // Trigger garbage collection if available
      if ('gc' in window) {
        (window as any).gc();
      }
      
      // Clear query cache if memory is critically high
      if (usedPercent > 95) {
        import('./lib/queryClient').then(({ queryClient }) => {
          queryClient.clear();
        });
      }
    }
  }
};

// Check memory every 30 seconds
memoryCheckInterval = setInterval(monitorMemory, 30000);

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