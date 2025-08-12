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
      // Only prevent default if it's a horizontal swipe and we're confident
      const currentX = e.targetTouches[0].clientX;
      const currentY = e.targetTouches[0].clientY;
      const diffX = Math.abs(currentX - touchStartX.current);
      const diffY = Math.abs(currentY - touchStartY.current);
      
      // More strict conditions to avoid conflicts with scrolling
      if (diffX > diffY && diffX > 30 && diffY < 15) {
        e.preventDefault();
        // Stop event propagation to prevent scroll detection
        e.stopPropagation();
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
    
    // More sophisticated swipe detection
    const horizontalRatio = Math.abs(distanceX) / Math.abs(distanceY);
    const isDefinitelyHorizontal = horizontalRatio > 2; // Horizontal movement is 2x more than vertical
    
    if (!isHorizontalSwipe || !isDefinitelyHorizontal) return;

    if (Math.abs(distanceX) > minSwipeDistance) {
      // Add haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      
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
    // Enhanced mobile detection
    const isMobile = ('ontouchstart' in window) || 
                     /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                     (window.innerWidth <= 768 && 'ontouchstart' in window);

    if (!isMobile) return;

    // Add event listeners with specific options to minimize conflicts
    const options = { passive: true };
    const moveOptions = { passive: false, capture: true };

    document.addEventListener('touchstart', handleTouchStart, options);
    document.addEventListener('touchmove', handleTouchMove, moveOptions);
    document.addEventListener('touchend', handleTouchEnd, options);

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