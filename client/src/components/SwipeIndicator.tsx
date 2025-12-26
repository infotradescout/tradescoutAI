import { useState, useEffect } from 'react';
import { safeStorage } from '../utils/safeStorage';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

interface SwipeIndicatorProps {
  className?: string;
  currentPageIndex?: number;
  totalPages?: number;
  onPrevious?: () => void;
  onNext?: () => void;
}

export function SwipeIndicator({ 
  className = "", 
  currentPageIndex = -1, 
  totalPages = 0,
  onPrevious,
  onNext 
}: SwipeIndicatorProps) {
  const [showIndicator, setShowIndicator] = useState(false);

  useEffect(() => {
    // Show swipe indicator on mobile for first-time users
    const hasSeenSwipeIndicator = safeStorage.get('hasSeenSwipeIndicator');
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                     window.innerWidth <= 768;

    if (isMobile && !hasSeenSwipeIndicator) {
      setShowIndicator(true);
      
      // Hide after 4 seconds
      const timer = setTimeout(() => {
        setShowIndicator(false);
        safeStorage.set('hasSeenSwipeIndicator', 'true');
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, []);

  if (!showIndicator) return null;

  return (
    <div className={`fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 ${className}`}>
      <div className="bg-slate-800/90 backdrop-blur-sm rounded-2xl px-6 py-4 border border-slate-700/50 shadow-xl">
        <div className="flex items-center justify-between gap-6 text-white">
          {/* Swipe Right/Previous Indicator */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 animate-pulse">
              <div className="w-8 h-0.5 bg-orange-400 rounded-full"></div>
              <div className="w-6 h-0.5 bg-orange-400/60 rounded-full"></div>
              <div className="w-4 h-0.5 bg-orange-400/30 rounded-full"></div>
            </div>
            <ChevronLeft className="w-5 h-5 text-orange-400" />
            <span className="text-sm font-medium">Previous</span>
          </div>

          {/* Page indicator */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const isActive = i === currentPageIndex % 5;
                return (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-all ${
                      isActive ? 'bg-blue-400 scale-125' : 'bg-slate-600'
                    }`}
                  />
                );
              })}
              {totalPages > 5 && (
                <MoreHorizontal className="w-3 h-3 text-slate-400" />
              )}
            </div>
          </div>

          {/* Swipe Left/Next Indicator */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Next</span>
            <ChevronRight className="w-5 h-5 text-blue-400" />
            <div className="flex items-center gap-2 animate-pulse">
              <div className="w-4 h-0.5 bg-blue-400/30 rounded-full"></div>
              <div className="w-6 h-0.5 bg-blue-400/60 rounded-full"></div>
              <div className="w-8 h-0.5 bg-blue-400 rounded-full"></div>
            </div>
          </div>
        </div>
        
        <div className="text-center mt-2">
          <p className="text-xs text-slate-400">
            Swipe to cycle through pages • Page {currentPageIndex + 1} of {totalPages}
          </p>
        </div>
      </div>
    </div>
  );
}