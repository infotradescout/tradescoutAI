import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Bug } from 'lucide-react';
import { showToast } from '@/components/ui/simple-toaster';

export const SimpleBugReportTool = memo(function SimpleBugReportTool() {
  const handleReportBug = () => {
    showToast('Bug report feature available - contact support for assistance', 'info');
  };

  return (
    <div className="fixed bottom-6 left-6 z-40">
      <Button
        onClick={handleReportBug}
        size="sm"
        variant="outline"
        className="bg-slate-800/80 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
        data-testid="bug-report-button"
      >
        <Bug className="w-4 h-4 mr-2" />
        Report Issue
      </Button>
    </div>
  );
});

export default SimpleBugReportTool;