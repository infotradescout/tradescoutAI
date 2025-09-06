import { memo } from 'react';
import { Hammer, Wrench } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  showLogo?: boolean;
}

export const LoadingSpinner = memo(function LoadingSpinner({ 
  message = "Loading...", 
  size = 'md',
  showLogo = true 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8', 
    lg: 'w-12 h-12'
  };

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-5 h-5',
    lg: 'w-8 h-8'
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {showLogo && (
        <div className="relative">
          <div className={`${sizeClasses[size]} border-2 border-orange-400 border-t-transparent rounded-full animate-spin`}></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Hammer className={`${iconSizeClasses[size]} text-orange-400 animate-pulse`} />
          </div>
        </div>
      )}
      
      {!showLogo && (
        <div className={`${sizeClasses[size]} border-2 border-orange-400 border-t-transparent rounded-full animate-spin`}></div>
      )}
      
      <div className="flex items-center space-x-2">
        <Wrench className="w-4 h-4 text-orange-400 animate-bounce" style={{ animationDelay: '0.1s' }} />
        <p className="text-white text-sm font-medium">{message}</p>
        <Wrench className="w-4 h-4 text-orange-400 animate-bounce" style={{ animationDelay: '0.2s' }} />
      </div>
    </div>
  );
});

export const PageLoadingSpinner = memo(function PageLoadingSpinner({ 
  message = "Loading page..." 
}: { message?: string }) {
  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center">
      <LoadingSpinner message={message} size="lg" />
    </div>
  );
});

export const ComponentLoadingSpinner = memo(function ComponentLoadingSpinner({ 
  message = "Loading..." 
}: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <LoadingSpinner message={message} size="md" />
    </div>
  );
});

export default LoadingSpinner;