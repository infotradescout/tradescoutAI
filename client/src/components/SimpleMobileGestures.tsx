import { memo, ReactNode } from 'react';

interface SimpleMobileGesturesProps {
  children: ReactNode;
}

const SimpleMobileGestures = memo(function SimpleMobileGestures({ children }: SimpleMobileGesturesProps) {
  return <div className="simple-mobile-gestures">{children}</div>;
});

export default SimpleMobileGestures;