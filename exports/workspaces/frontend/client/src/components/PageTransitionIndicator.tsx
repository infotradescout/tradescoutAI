import { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft } from 'lucide-react';

interface PageTransitionIndicatorProps {
  direction?: 'left' | 'right';
  isVisible?: boolean;
  currentPage?: string;
  className?: string;
}

export function PageTransitionIndicator({ 
  direction = 'right', 
  isVisible = false, 
  currentPage = '',
  className = "" 
}: PageTransitionIndicatorProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShow(true);
      const timer = setTimeout(() => setShow(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!show) return null;

  const Icon = direction === 'left' ? ArrowLeft : ArrowRight;
  const slideDirection = direction === 'left' ? 'animate-slide-in-left' : 'animate-slide-in-right';

  return (
    <div className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 ${className}`}>
      <div className={`bg-tsCard/95 backdrop-blur-sm rounded-xl px-6 py-4 border border-ts-orange/30 shadow-2xl ${slideDirection}`}>
        <div className="flex items-center gap-3 text-white">
          <Icon className={`w-6 h-6 text-ts-orange ${direction === 'left' ? 'animate-bounce-left' : 'animate-bounce-right'}`} />
          <div>
            <div className="text-sm font-medium text-ts-orange">Navigating to</div>
            <div className="text-lg font-semibold">{currentPage}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Add custom animations to the global CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes slide-in-right {
    from {
      opacity: 0;
      transform: translateX(50px) translateY(-50%);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(-50%);
    }
  }

  @keyframes slide-in-left {
    from {
      opacity: 0;
      transform: translateX(-50px) translateY(-50%);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(-50%);
    }
  }

  @keyframes bounce-right {
    0%, 20%, 50%, 80%, 100% {
      transform: translateX(0);
    }
    40% {
      transform: translateX(10px);
    }
    60% {
      transform: translateX(5px);
    }
  }

  @keyframes bounce-left {
    0%, 20%, 50%, 80%, 100% {
      transform: translateX(0);
    }
    40% {
      transform: translateX(-10px);
    }
    60% {
      transform: translateX(-5px);
    }
  }

  .animate-slide-in-right {
    animation: slide-in-right 0.5s ease-out;
  }

  .animate-slide-in-left {
    animation: slide-in-left 0.5s ease-out;
  }

  .animate-bounce-right {
    animation: bounce-right 0.8s infinite;
  }

  .animate-bounce-left {
    animation: bounce-left 0.8s infinite;
  }
`;

if (!document.head.querySelector('#page-transition-styles')) {
  style.id = 'page-transition-styles';
  document.head.appendChild(style);
}