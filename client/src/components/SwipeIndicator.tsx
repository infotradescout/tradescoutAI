import { useState, useEffect } from 'react';
import { User, MessageCircle } from 'lucide-react';

interface SwipeIndicatorProps {
  className?: string;
}

export function SwipeIndicator({ className = "" }: SwipeIndicatorProps) {
  const [showIndicator, setShowIndicator] = useState(false);

  useEffect(() => {
    // Show swipe indicator on mobile for first-time users
    const hasSeenSwipeIndicator = localStorage.getItem('hasSeenSwipeIndicator');
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                     window.innerWidth <= 768;

    if (isMobile && !hasSeenSwipeIndicator) {
      setShowIndicator(true);
      
      // Hide after 4 seconds
      const timer = setTimeout(() => {
        setShowIndicator(false);
        localStorage.setItem('hasSeenSwipeIndicator', 'true');
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, []);

  if (!showIndicator) return null;

  return (
    <div className={`fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 ${className}`}>
      <div className="bg-slate-800/90 backdrop-blur-sm rounded-2xl px-6 py-4 border border-slate-700/50 shadow-xl">
        <div className="flex items-center justify-between gap-8 text-white">
          {/* Swipe Right Indicator */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 animate-pulse">
              <div className="w-8 h-0.5 bg-orange-400 rounded-full"></div>
              <div className="w-6 h-0.5 bg-orange-400/60 rounded-full"></div>
              <div className="w-4 h-0.5 bg-orange-400/30 rounded-full"></div>
            </div>
            <User className="w-5 h-5 text-orange-400" />
            <span className="text-sm font-medium">Profile</span>
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-slate-600"></div>

          {/* Swipe Left Indicator */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Messages</span>
            <MessageCircle className="w-5 h-5 text-blue-400" />
            <div className="flex items-center gap-2 animate-pulse">
              <div className="w-4 h-0.5 bg-blue-400/30 rounded-full"></div>
              <div className="w-6 h-0.5 bg-blue-400/60 rounded-full"></div>
              <div className="w-8 h-0.5 bg-blue-400 rounded-full"></div>
            </div>
          </div>
        </div>
        
        <div className="text-center mt-2">
          <p className="text-xs text-slate-400">Swipe to navigate quickly</p>
        </div>
      </div>
    </div>
  );
}