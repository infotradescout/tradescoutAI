import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { aiMonitoringService } from '@/services/aiMonitoring';

export function useAIMonitoring() {
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    // Only enable monitoring for admin users to avoid performance impact
    const shouldMonitor = isAuthenticated && user?.role && 
      ['head_admin', 'ops_admin'].includes(user.role);

    if (shouldMonitor) {
      // Initialize monitoring service
      aiMonitoringService.initializeMonitoring();

      // Log monitoring activation
      console.log('🤖 AI Site Monitoring Active - Analyzing UX patterns and detecting issues...');

      return () => {
        // Cleanup monitoring when component unmounts
        aiMonitoringService.destroy();
      };
    }
  }, [isAuthenticated, user?.role]);

  return {
    isMonitoring: isAuthenticated && user?.role && ['head_admin', 'ops_admin'].includes(user.role),
    getIssues: () => aiMonitoringService.getIssues(),
    clearIssues: () => aiMonitoringService.clearIssues()
  };
}