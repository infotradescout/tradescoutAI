import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { aiMonitoringService } from '@/services/aiMonitoring';

export function useAIMonitoring() {
  const { user, isAuthenticated } = useAuth();

  // Assuming isAdmin is derived from user.role, and it's defined elsewhere or passed as a prop.
  // Consider users with head_admin, ops_admin, or super_admin roles as admins.
  const isAdmin = isAuthenticated && user?.role && ['head_admin', 'ops_admin', 'super_admin'].includes(user.role);

  // Placeholder for reportIssue function, assuming it's defined in the scope or imported.
  const reportIssue = (issue: any) => {
    console.error("Reporting Issue:", issue);
    // In a real scenario, this would likely call aiMonitoringService.reportIssue or a similar method.
  };

  useEffect(() => {
    if (!isAdmin) return;

    const cleanup: (() => void)[] = [];
    let performanceCheckCount = 0;

    // Throttled performance monitoring
    if ('performance' in window && 'observer' in window.PerformanceObserver.prototype) {
      const perfObserver = new PerformanceObserver((list) => {
        performanceCheckCount++;

        // Throttle performance checks to reduce memory usage
        if (performanceCheckCount % 5 !== 0) return;

        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure' || entry.entryType === 'navigation') {
            if (entry.duration > 50) { // Long tasks
              reportIssue({
                type: 'performance',
                severity: entry.duration > 250 ? 'high' : 'medium',
                title: 'Long JavaScript Task',
                description: `Task blocked main thread for ${entry.duration.toFixed(2)}ms`,
                suggestions: [
                  'Break up long-running JavaScript into smaller chunks',
                  'Use Web Workers for heavy computations',
                  'Implement code splitting and lazy loading'
                ]
              });
            }
          }
        }

        // Clear old entries to prevent memory buildup
        if (performanceCheckCount > 100) {
          performanceCheckCount = 0;
        }
      });

      perfObserver.observe({ entryTypes: ['measure', 'navigation', 'longtask'] });
      cleanup.push(() => perfObserver.disconnect());
    }

    // Throttled memory monitoring
    let memoryCheckCount = 0;
    const checkMemory = () => {
      memoryCheckCount++;

      // Only check memory every 3rd time to reduce overhead
      if (memoryCheckCount % 3 !== 0) return;

      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const usedPercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;

        if (usedPercent > 90) {
          reportIssue({
            type: 'performance',
            severity: 'high',
            title: 'High Memory Usage',
            description: `JavaScript heap usage at ${usedPercent.toFixed(1)}%`,
            suggestions: [
              'Check for memory leaks in event listeners',
              'Clear unused references and intervals',
              'Optimize large data structures'
            ]
          });
        }
      }
    };

    const memoryInterval = setInterval(checkMemory, 60000); // Check every 60 seconds instead of 30
    cleanup.push(() => clearInterval(memoryInterval));

    // Original AI monitoring initialization
    aiMonitoringService.initializeMonitoring();
    console.log('🤖 AI Site Monitoring Active - Analyzing UX patterns and detecting issues...');


    return () => {
      // Cleanup monitoring when component unmounts
      aiMonitoringService.destroy();
      // Execute all cleanup functions
      cleanup.forEach(cb => cb());
    };
  }, [isAuthenticated, user?.role, isAdmin]); // Include isAdmin in dependency array

  return {
    isMonitoring: isAdmin,
    getIssues: () => aiMonitoringService.getIssues(),
    clearIssues: () => aiMonitoringService.clearIssues()
  };
}