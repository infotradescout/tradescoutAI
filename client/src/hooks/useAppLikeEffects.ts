
import { useEffect } from 'react';
import { useIsMobile } from './use-mobile';

export function useAppLikeEffects() {
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isMobile) return;

    // Prevent default browser behaviors for app-like experience
    const preventDefault = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault(); // Prevent pinch zoom
      }
    };

    const preventBounce = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return; // Allow scrolling in input fields
      }
      
      const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
      const clientHeight = document.documentElement.clientHeight || window.innerHeight;
      
      if (scrollTop === 0 && e.touches[0].clientY > e.touches[0].clientY) {
        e.preventDefault(); // Prevent overscroll at top
      }
      
      if (scrollTop + clientHeight >= scrollHeight && e.touches[0].clientY < e.touches[0].clientY) {
        e.preventDefault(); // Prevent overscroll at bottom
      }
    };

    // Add haptic feedback for interactions
    const addHapticFeedback = (selector: string) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        element.addEventListener('touchstart', () => {
          if ('vibrate' in navigator) {
            navigator.vibrate(10); // Very light haptic feedback
          }
        });
      });
    };

    // Apply app-like behaviors
    document.addEventListener('touchmove', preventDefault, { passive: false });
    document.addEventListener('touchmove', preventBounce, { passive: false });
    
    // Add haptic feedback to interactive elements
    addHapticFeedback('button, .button, [role="button"]');
    
    // Set viewport height for mobile browsers
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);

    return () => {
      document.removeEventListener('touchmove', preventDefault);
      document.removeEventListener('touchmove', preventBounce);
      window.removeEventListener('resize', setVH);
      window.removeEventListener('orientationchange', setVH);
    };
  }, [isMobile]);

  useEffect(() => {
    // Register service worker for PWA functionality only in production
    if (import.meta.env.PROD && 'serviceWorker' in navigator && isMobile) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('SW registered: ', registration);
        })
        .catch(registrationError => {
          console.log('SW registration failed: ', registrationError);
        });
    }
  }, [isMobile]);
}
