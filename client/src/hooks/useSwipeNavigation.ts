import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';

interface SwipeNavigationOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  preventDefaultTouchMove?: boolean;
}

export function useSwipeNavigation({
  onSwipeLeft,
  onSwipeRight,
  threshold = 100,
  preventDefaultTouchMove = false
}: SwipeNavigationOptions) {
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const touchEndY = useRef<number>(0);
  const minSwipeDistance = threshold;

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (preventDefaultTouchMove) {
      // Only prevent default if it's a horizontal swipe
      const currentX = e.targetTouches[0].clientX;
      const currentY = e.targetTouches[0].clientY;
      const diffX = Math.abs(currentX - touchStartX.current);
      const diffY = Math.abs(currentY - touchStartY.current);
      
      if (diffX > diffY && diffX > 20) {
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    touchEndY.current = e.changedTouches[0].clientY;
    handleSwipe();
  };

  const handleSwipe = () => {
    const distanceX = touchStartX.current - touchEndX.current;
    const distanceY = touchStartY.current - touchEndY.current;
    const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY);

    if (!isHorizontalSwipe) return;

    if (Math.abs(distanceX) > minSwipeDistance) {
      if (distanceX > 0) {
        // Swiped left
        onSwipeLeft?.();
      } else {
        // Swiped right
        onSwipeRight?.();
      }
    }
  };

  useEffect(() => {
    // Only enable on mobile devices
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                     window.innerWidth <= 768;

    if (!isMobile) return;

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight]);
}

// Hook for global swipe navigation
export function useGlobalSwipeNavigation() {
  const [, setLocation] = useLocation();

  const navigateToProfile = () => {
    setLocation('/dashboard/account');
  };

  const navigateToMessages = () => {
    setLocation('/conversations');
  };

  useSwipeNavigation({
    onSwipeRight: navigateToProfile,
    onSwipeLeft: navigateToMessages,
    threshold: 80,
    preventDefaultTouchMove: true
  });
}