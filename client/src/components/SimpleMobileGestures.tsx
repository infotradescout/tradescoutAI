import { ReactNode } from 'react';

interface SimpleMobileGesturesProps {
  children: ReactNode;
}

export function SimpleMobileGestures({ children }: SimpleMobileGesturesProps) {
  // Simple wrapper without hooks to avoid context errors
  return (
    <div className="mobile-gestures-container">
      {children}
    </div>
  );
}

export default SimpleMobileGestures;