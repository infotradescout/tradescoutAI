import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';

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

// Define the page order for sequential navigation - dashboard first for authenticated users
const PAGE_ORDER = [
  '/dashboard',
  '/contractors',
  '/calculator',
  '/contractors/for-contractors',
  '/foundation',
  '/community',
  '/helpers',
  '/exchange',
  '/accelerator',
  '/leaderboard',
  '/growth-pack'
];

// Unauthenticated user page order
const GUEST_PAGE_ORDER = [
  '/',
  '/contractors',
  '/calculator',
  '/contractors/for-contractors',
  '/foundation',
  '/community',
  '/helpers',
  '/exchange',
  '/accelerator',
  '/leaderboard',
  '/growth-pack'
];

// Helper function to get display names for pages
function getPageDisplayName(path: string): string {
  const displayNames: { [key: string]: string } = {
    '/': 'Home',
    '/contractors': 'Contractors',
    '/calculator': 'Quote Calculator',
    '/dashboard': 'Dashboard',
    '/contractors/for-contractors': 'For Contractors',
    '/foundation': 'Foundation',
    '/community': 'Community',
    '/helpers': 'Helpers',
    '/exchange': 'Exchange',
    '/accelerator': 'Accelerator',
    '/leaderboard': 'Leaderboard',
    '/growth-pack': 'Growth Pack'
  };
  
  return displayNames[path] || path;
}

// Hook for global swipe navigation with page cycling
export function useGlobalSwipeNavigation() {
  const [location, setLocation] = useLocation();
  const [transitionState, setTransitionState] = useState<{
    isTransitioning: boolean;
    direction: 'left' | 'right' | null;
    targetPage: string;
  }>({
    isTransitioning: false,
    direction: null,
    targetPage: ''
  });

  // Import useAuth hook within the component scope
  const { isAuthenticated } = useAuth();

  // Fetch user navigation preferences
  const { data: navigationPrefs } = useQuery({
    queryKey: ['/api/user/navigation-preferences'],
    enabled: isAuthenticated,
    retry: false,
  });

  // Function to apply user preferences to page order
  const getCustomizedPageOrder = () => {
    const defaultOrder = isAuthenticated ? PAGE_ORDER : GUEST_PAGE_ORDER;
    
    // If user has custom order preferences, apply them
    if (navigationPrefs?.customOrder && navigationPrefs.customOrder.length > 0) {
      // Start with user's custom order
      const customOrder = navigationPrefs.customOrder.filter(page => defaultOrder.includes(page));
      // Add any pages that weren't in the custom order at the end
      const remainingPages = defaultOrder.filter(page => !customOrder.includes(page));
      const fullCustomOrder = [...customOrder, ...remainingPages];
      
      // Filter out pages hidden from swipe navigation
      if (navigationPrefs.hiddenFromSwipe && navigationPrefs.hiddenFromSwipe.length > 0) {
        return fullCustomOrder.filter(page => !navigationPrefs.hiddenFromSwipe.includes(page));
      }
      
      return fullCustomOrder;
    }
    
    // Filter out hidden pages from default order
    if (navigationPrefs?.hiddenFromSwipe && navigationPrefs.hiddenFromSwipe.length > 0) {
      return defaultOrder.filter(page => !navigationPrefs.hiddenFromSwipe.includes(page));
    }
    
    return defaultOrder;
  };

  // Use customized page order or fall back to default
  const currentPageOrder = getCustomizedPageOrder();

  const getCurrentPageIndex = () => {
    // Find exact match first
    let currentIndex = currentPageOrder.findIndex(page => page === location);
    
    // If no exact match, find partial match (for nested routes)
    if (currentIndex === -1) {
      currentIndex = currentPageOrder.findIndex(page => {
        if (page === '/') return location === '/';
        return location.startsWith(page);
      });
    }
    
    return currentIndex;
  };

  const navigateToNextPage = () => {
    const currentIndex = getCurrentPageIndex();
    if (currentIndex === -1) return;
    
    const nextIndex = (currentIndex + 1) % currentPageOrder.length;
    const targetPage = currentPageOrder[nextIndex];
    
    // Show transition feedback
    setTransitionState({
      isTransitioning: true,
      direction: 'right',
      targetPage: getPageDisplayName(targetPage)
    });
    
    setTimeout(() => {
      setLocation(targetPage);
      setTransitionState(prev => ({ ...prev, isTransitioning: false }));
    }, 200);
  };

  const navigateToPreviousPage = () => {
    const currentIndex = getCurrentPageIndex();
    if (currentIndex === -1) return;
    
    const prevIndex = currentIndex === 0 ? currentPageOrder.length - 1 : currentIndex - 1;
    const targetPage = currentPageOrder[prevIndex];
    
    // Show transition feedback
    setTransitionState({
      isTransitioning: true,
      direction: 'left',
      targetPage: getPageDisplayName(targetPage)
    });
    
    setTimeout(() => {
      setLocation(targetPage);
      setTransitionState(prev => ({ ...prev, isTransitioning: false }));
    }, 200);
  };

  // Only enable swipe navigation if user preference allows it
  const swipeEnabled = navigationPrefs?.enableSwipeNavigation !== false;
  
  useSwipeNavigation({
    onSwipeLeft: swipeEnabled ? navigateToNextPage : undefined,
    onSwipeRight: swipeEnabled ? navigateToPreviousPage : undefined,
    threshold: 80,
    preventDefaultTouchMove: swipeEnabled
  });

  // Add keyboard and mouse navigation support for desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle arrow keys if not in input, textarea, or contenteditable elements
      const activeElement = document.activeElement;
      const isInputElement = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute('contenteditable') === 'true'
      );

      if (isInputElement) return;

      // Handle Left/Right arrow keys for page navigation
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateToPreviousPage();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateToNextPage();
      }
    };

    const handleWheel = (e: WheelEvent) => {
      // Only handle horizontal wheel events when Shift is held
      if (!e.shiftKey) return;

      const activeElement = document.activeElement;
      const isInputElement = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute('contenteditable') === 'true'
      );

      if (isInputElement) return;

      e.preventDefault();
      
      // Navigate based on wheel direction
      if (e.deltaX > 0 || e.deltaY > 0) {
        navigateToNextPage();
      } else if (e.deltaX < 0 || e.deltaY < 0) {
        navigateToPreviousPage();
      }
    };

    // Only add keyboard listeners on desktop (non-touch devices)
    const isDesktop = !('ontouchstart' in window) && window.innerWidth > 768;
    
    if (isDesktop) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('wheel', handleWheel);
      };
    }
  }, [navigateToNextPage, navigateToPreviousPage]);

  return {
    currentPageIndex: getCurrentPageIndex(),
    totalPages: currentPageOrder.length,
    navigateToNextPage,
    navigateToPreviousPage,
    pageOrder: currentPageOrder,
    transitionState
  };
}