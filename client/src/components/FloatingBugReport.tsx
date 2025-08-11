import { BugReportButton } from './BugReportButton';

export function FloatingBugReport() {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <BugReportButton className="shadow-lg hover:shadow-xl transition-shadow" />
    </div>
  );
}