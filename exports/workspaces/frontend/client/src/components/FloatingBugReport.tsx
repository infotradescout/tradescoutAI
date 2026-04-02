import { useState, useRef, useEffect } from 'react';
import { BugReportButton } from './BugReportButton';
import { Move } from 'lucide-react';

export function FloatingBugReport() {
  const [position, setPosition] = useState(() => {
    // Default to bottom-right corner
    if (typeof window !== 'undefined') {
      return { 
        x: window.innerWidth - 84, // 60px button width + 24px margin
        y: window.innerHeight - 84 // 60px button height + 24px margin
      };
    }
    return { x: 0, y: 0 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialPosition, setInitialPosition] = useState({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLDivElement>(null);

  // Load saved position from localStorage
  useEffect(() => {
    const savedPosition = localStorage.getItem('floatingBugReportPosition');
    if (savedPosition) {
      try {
        const parsed = JSON.parse(savedPosition);
        // Validate position is within current viewport
        const validX = Math.max(0, Math.min(window.innerWidth - 60, parsed.x));
        const validY = Math.max(0, Math.min(window.innerHeight - 60, parsed.y));
        setPosition({ x: validX, y: validY });
      } catch (e) {
        // Ignore invalid saved position
      }
    }
  }, []);

  // Save position to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('floatingBugReportPosition', JSON.stringify(position));
  }, [position]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Allow dragging from anywhere on the button container
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialPosition(position);
    e.preventDefault();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // Allow dragging from anywhere on the button container  
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX, y: touch.clientY });
    setInitialPosition(position);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      const newX = Math.max(0, Math.min(window.innerWidth - 60, initialPosition.x + deltaX));
      const newY = Math.max(0, Math.min(window.innerHeight - 60, initialPosition.y + deltaY));
      
      setPosition({ x: newX, y: newY });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - dragStart.x;
      const deltaY = touch.clientY - dragStart.y;
      
      const newX = Math.max(0, Math.min(window.innerWidth - 60, initialPosition.x + deltaX));
      const newY = Math.max(0, Math.min(window.innerHeight - 60, initialPosition.y + deltaY));
      
      setPosition({ x: newX, y: newY });
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleEnd);
      };
    }
  }, [isDragging, dragStart, initialPosition]);

  return (
    <div
      ref={buttonRef}
      className={`fixed z-50 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transition: isDragging ? 'none' : 'all 0.2s ease-out',
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <div className="relative group">
        {/* Drag handle indicator */}
        <div className={`absolute -top-1 -left-1 bg-white/10 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${isDragging ? 'opacity-100' : ''}`}>
          <Move size={12} className="text-white" />
        </div>
        
        {/* Bug report button wrapper */}
        <div className={`bug-report-content shadow-lg hover:shadow-xl transition-shadow ${isDragging ? 'scale-105' : ''}`}>
          <BugReportButton />
        </div>
        
        {/* Visual feedback when dragging */}
        {isDragging && (
          <div className="absolute inset-0 bg-ts-orange/20 rounded-full animate-pulse pointer-events-none" />
        )}
      </div>
    </div>
  );
}