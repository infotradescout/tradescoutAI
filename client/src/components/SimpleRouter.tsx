import { ReactNode } from 'react';

interface SimpleRouterProps {
  children: ReactNode;
}

export function SimpleRouter({ children }: SimpleRouterProps) {
  // Simple wrapper that doesn't use any hooks or context
  return (
    <div className="simple-router">
      {children}
    </div>
  );
}

export default SimpleRouter;