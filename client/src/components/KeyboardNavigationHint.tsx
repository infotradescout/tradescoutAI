import { useState, useEffect } from 'react';
import { safeStorage } from '../utils/safeStorage';
import { Keyboard, ChevronLeft, ChevronRight, MousePointer } from 'lucide-react';

interface KeyboardNavigationHintProps {
  className?: string;
}

export function KeyboardNavigationHint({ className = "" }: KeyboardNavigationHintProps) {
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    // Only show on desktop devices
    const isDesktop = !('ontouchstart' in window) && window.innerWidth > 768;
    
    if (!isDesktop) return;

    // Show hint for first-time desktop users
    const hasSeenKeyboardHint = safeStorage.get('hasSeenKeyboardNavigationHint');
    
    if (!hasSeenKeyboardHint) {
      // Delay showing hint slightly to avoid overwhelming new users
      const timer = setTimeout(() => {
        setShowHint(true);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (showHint) {
      // Auto-hide after 6 seconds
      const timer = setTimeout(() => {
        setShowHint(false);
        safeStorage.set('hasSeenKeyboardNavigationHint', 'true');
      }, 6000);

      return () => clearTimeout(timer);
    }
  }, [showHint]);

  if (!showHint) return null;

  return (
    <div className={`fixed top-24 right-6 z-50 ${className}`}>
      <div className="bg-tsCard/95 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10 shadow-xl max-w-sm">
        <div className="flex items-start gap-3">
          <Keyboard className="w-5 h-5 text-ts-orange mt-0.5 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <div className="text-white font-medium mb-2">Navigation Shortcuts</div>
            
            <div className="space-y-2 text-white/70">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <ChevronLeft className="w-3 h-3" />
                  <ChevronRight className="w-3 h-3" />
                </div>
                <span className="text-xs">Arrow keys to cycle pages</span>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <MousePointer className="w-3 h-3" />
                  <span className="text-xs">Shift</span>
                </div>
                <span className="text-xs">Shift + scroll to navigate</span>
              </div>
            </div>
            
            <div className="mt-2 pt-2 border-t border-white/10">
              <p className="text-xs text-white/60">
                Or use the dropdown menu for direct access
              </p>
            </div>
          </div>
          
          <button
            onClick={() => {
              setShowHint(false);
              localStorage.setItem('hasSeenKeyboardNavigationHint', 'true');
            }}
            className="text-white/60 hover:text-white transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}