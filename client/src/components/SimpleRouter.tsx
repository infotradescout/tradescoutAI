import { ReactNode } from 'react';
import { Router } from 'wouter';

interface SimpleRouterProps {
  children: ReactNode;
}

export function SimpleRouter({ children }: SimpleRouterProps) {
  return (
    <Router>
      {children}
    </Router>
  );
}

export default SimpleRouter;