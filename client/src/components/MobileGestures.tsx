
import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useIsMobile } from '@/hooks/use-mobile';

interface MobileGesturesProps {
  children: React.ReactNode;
}

export function MobileGestures({ children }: MobileGesturesProps) {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const isDragging = useRef<boolean>(false);

  useEffect(() => {
    if (!isMobile || !containerRef.current) return;

    const container = containerRef.current;
    let rafId: number;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      isDragging.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) {
        const deltaX = Math.abs(e.touches[0].clientX - touchStartX.current);
        const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current);
        
        // Start dragging if horizontal movement is greater than vertical
        if (deltaX > deltaY && deltaX > 10) {
          isDragging.current = true;
          e.preventDefault(); // Prevent scroll
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isDragging.current) return;

      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      const threshold = window.innerWidth * 0.25; // 25% of screen width

      // Right swipe (back gesture)
      if (deltaX > threshold) {
        // Add haptic feedback if available
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
        
        // Go back in history
        window.history.back();
      }
      // Left swipe could be used for forward navigation or other actions
      else if (deltaX < -threshold) {
        // Custom action here
      }

      isDragging.current = false;
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isMobile]);

  return (
    <div ref={containerRef} className="min-h-screen">
      {children}
    </div>
  );
}
