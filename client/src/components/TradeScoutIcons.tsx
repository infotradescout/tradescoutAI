import React from 'react';

interface IconProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  variant?: 'standard' | 'gradient' | 'outline' | 'minimal';
}

const sizeClasses = {
  xs: 'w-4 h-4',
  sm: 'w-6 h-6', 
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
  xl: 'w-12 h-12',
  '2xl': 'w-16 h-16'
};

// Enhanced TradeScout Logo with Professional Design
export function TradeScoutLogo({ className = "", size = 'md', variant = 'standard' }: IconProps) {
  const sizeClass = sizeClasses[size];
  
  const gradients = variant === 'gradient' ? (
    <defs>
      <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FF6B35" />
        <stop offset="50%" stopColor="#F97316" />
        <stop offset="100%" stopColor="#EA580C" />
      </linearGradient>
      <linearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FBB040" />
        <stop offset="100%" stopColor="#FF8C00" />
      </linearGradient>
    </defs>
  ) : null;

  if (variant === 'minimal') {
    return (
      <svg viewBox="0 0 100 100" className={`${sizeClass} ${className}`}>
        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="3"/>
        <path d="M30 40 Q25 40 25 45 L25 55 Q25 60 30 60 L35 60 L45 70 L55 60 L60 60 Q65 60 65 55 L65 45 Q65 40 60 40 Z" fill="currentColor"/>
        <rect x="45" y="65" width="10" height="15" fill="currentColor" rx="2"/>
      </svg>
    );
  }

  if (variant === 'outline') {
    return (
      <svg viewBox="0 0 100 100" className={`${sizeClass} ${className}`}>
        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2"/>
        <path d="M30 40 Q25 40 25 45 L25 55 Q25 60 30 60 L35 60 L45 70 L55 60 L60 60 Q65 60 65 55 L65 45 Q65 40 60 40 Z" 
              fill="none" stroke="currentColor" strokeWidth="2"/>
        <rect x="45" y="65" width="10" height="15" fill="none" stroke="currentColor" strokeWidth="2" rx="2"/>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 100 100" className={`${sizeClass} ${className}`}>
      {gradients}
      
      {/* Background Circle with Shadow Effect */}
      <circle cx="52" cy="52" r="45" fill="rgba(0,0,0,0.1)" opacity="0.3"/>
      <circle cx="50" cy="50" r="45" 
              fill={variant === 'gradient' ? 'url(#logoGradient)' : 'currentColor'} 
              opacity="0.15" 
              stroke={variant === 'gradient' ? 'url(#logoGradient)' : 'currentColor'} 
              strokeWidth="2"/>
      
      {/* Professional Hammer Design */}
      <g transform="translate(50,50)">
        {/* Hammer Head - Enhanced 3D Effect */}
        <rect x="-20" y="-10" width="25" height="12" 
              fill={variant === 'gradient' ? 'url(#logoGradient)' : 'currentColor'} 
              rx="3"/>
        <rect x="-20" y="-8" width="25" height="3" 
              fill={variant === 'gradient' ? 'url(#accentGradient)' : 'rgba(255,255,255,0.3)'} 
              rx="1"/>
        
        {/* Hammer Handle with Grip Detail */}
        <rect x="2" y="-4" width="30" height="8" 
              fill={variant === 'gradient' ? 'url(#logoGradient)' : 'currentColor'} 
              rx="4"/>
        
        {/* Handle Grip Texture */}
        <rect x="8" y="-2" width="2" height="4" fill="rgba(255,255,255,0.2)" rx="1"/>
        <rect x="12" y="-2" width="2" height="4" fill="rgba(255,255,255,0.2)" rx="1"/>
        <rect x="16" y="-2" width="2" height="4" fill="rgba(255,255,255,0.2)" rx="1"/>
        <rect x="20" y="-2" width="2" height="4" fill="rgba(255,255,255,0.2)" rx="1"/>
        
        {/* Hammer Claw */}
        <path d="M-18 -10 Q-22 -15 -25 -10 Q-22 -5 -18 -2" 
              fill={variant === 'gradient' ? 'url(#logoGradient)' : 'currentColor'}/>
        
        {/* Handle End Cap */}
        <circle cx="32" cy="0" r="4" 
                fill={variant === 'gradient' ? 'url(#accentGradient)' : 'currentColor'}/>
        
        {/* Professional Highlights */}
        <rect x="-18" y="-8" width="20" height="1" 
              fill="rgba(255,255,255,0.4)" rx="0.5"/>
        <rect x="4" y="-2" width="26" height="1" 
              fill="rgba(255,255,255,0.3)" rx="0.5"/>
      </g>
    </svg>
  );
}

// Enhanced Simplified Icon for Favicons and Small Spaces
export function TradeScoutIcon({ className = "", size = 'md', variant = 'standard' }: IconProps) {
  const sizeClass = sizeClasses[size];
  
  return (
    <svg viewBox="0 0 100 100" className={`${sizeClass} ${className}`}>
      <defs>
        <linearGradient id="iconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF6B35" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
      </defs>
      
      {/* Modern Background */}
      <rect width="100" height="100" 
            fill={variant === 'gradient' ? 'url(#iconGradient)' : 'currentColor'} 
            rx="20"/>
      
      {/* Simplified Hammer Icon */}
      <g transform="translate(50,50)" fill="white">
        {/* Clean hammer head */}
        <rect x="-15" y="-6" width="18" height="8" rx="2"/>
        {/* Clean handle */}
        <rect x="0" y="-3" width="20" height="6" rx="3"/>
        {/* End cap */}
        <circle cx="20" cy="0" r="3"/>
      </g>
      
      {/* Modern highlight */}
      <rect x="20" y="20" width="60" height="1" fill="rgba(255,255,255,0.3)" rx="0.5"/>
    </svg>
  );
}

// Professional Brand Mark with Text
export function TradeScoutBrand({ className = "", size = 'lg', showText = true }: IconProps & { showText?: boolean }) {
  const sizeClass = sizeClasses[size];
  
  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <div className={`${sizeClass} flex-shrink-0`}>
        <TradeScoutLogo variant="gradient" />
      </div>
      {showText && (
        <div className="flex flex-col">
          <span className="text-xl font-bold text-white tracking-tight leading-tight">
            TradeScout
          </span>
          <span className="text-xs text-slate-400 font-medium leading-tight">
            Professional Network
          </span>
        </div>
      )}
    </div>
  );
}

// Enhanced Construction Tools Collection (Improved from ConstructionEmblem)
export const constructionIcons = {
  hammer: (props: IconProps) => (
    <svg viewBox="0 0 100 100" className={`${sizeClasses[props.size || 'md']} ${props.className}`}>
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="2"/>
      <g transform="translate(50,50)">
        <rect x="-20" y="-8" width="25" height="12" fill="currentColor" rx="3"/>
        <rect x="2" y="-4" width="30" height="8" fill="currentColor" rx="4"/>
        <path d="M-18 -8 Q-22 -12 -25 -8 Q-22 -4 -18 -2" fill="currentColor"/>
        <circle cx="32" cy="0" r="4" fill="currentColor"/>
      </g>
    </svg>
  ),
  
  wrench: (props: IconProps) => (
    <svg viewBox="0 0 100 100" className={`${sizeClasses[props.size || 'md']} ${props.className}`}>
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="2"/>
      <path d="M30 25 Q25 25 25 30 L25 40 Q25 45 30 45 L35 45 L45 55 L55 45 L60 45 Q65 45 65 40 L65 30 Q65 25 60 25 Z" fill="currentColor"/>
      <rect x="45" y="50" width="10" height="25" fill="currentColor" rx="3"/>
      <circle cx="45" cy="35" r="3" fill="rgba(255,255,255,0.3)"/>
    </svg>
  ),
  
  drill: (props: IconProps) => (
    <svg viewBox="0 0 100 100" className={`${sizeClasses[props.size || 'md']} ${props.className}`}>
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="2"/>
      <rect x="25" y="40" width="40" height="15" fill="currentColor" rx="7"/>
      <rect x="65" y="45" width="8" height="5" fill="currentColor" rx="2"/>
      <circle cx="30" cy="47.5" r="3" fill="rgba(255,255,255,0.4)"/>
      <rect x="73" y="46" width="4" height="3" fill="currentColor"/>
    </svg>
  ),
  
  level: (props: IconProps) => (
    <svg viewBox="0 0 100 100" className={`${sizeClasses[props.size || 'md']} ${props.className}`}>
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="2"/>
      <rect x="20" y="45" width="60" height="10" fill="currentColor" rx="5"/>
      <circle cx="50" cy="50" r="6" fill="rgba(255,255,255,0.4)"/>
      <circle cx="50" cy="50" r="2" fill="currentColor"/>
    </svg>
  ),
  
  hardhat: (props: IconProps) => (
    <svg viewBox="0 0 100 100" className={`${sizeClasses[props.size || 'md']} ${props.className}`}>
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="2"/>
      <path d="M20 55 Q20 35 50 35 Q80 35 80 55 L75 65 L25 65 Z" fill="currentColor"/>
      <rect x="47" y="30" width="6" height="8" fill="currentColor"/>
      <rect x="20" y="65" width="60" height="6" fill="currentColor" rx="3"/>
      <rect x="45" y="42" width="10" height="2" fill="rgba(255,255,255,0.3)"/>
    </svg>
  )
};

// Icon Selector Component
export function TradeScoutIconSelector({ type, ...props }: IconProps & { type: 'logo' | 'icon' | 'brand' | keyof typeof constructionIcons }) {
  switch (type) {
    case 'logo':
      return <TradeScoutLogo {...props} />;
    case 'icon':
      return <TradeScoutIcon {...props} />;
    case 'brand':
      return <TradeScoutBrand {...props} />;
    default:
      if (type in constructionIcons) {
        const IconComponent = constructionIcons[type as keyof typeof constructionIcons];
        return <IconComponent {...props} />;
      }
      return <TradeScoutLogo {...props} />;
  }
}