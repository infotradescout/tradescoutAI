import { memo, ReactNode } from 'react';

interface SimpleRouterProps {
  children: ReactNode;
}

const SimpleRouter = memo(function SimpleRouter({ children }: SimpleRouterProps) {
  return <div className="simple-router">{children}</div>;
});

export default SimpleRouter;