import React from "react";

interface IconProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  variant?: "standard" | "gradient" | "outline" | "minimal";
}

const sizeClasses = {
  xs: "w-4 h-4",
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-10 h-10",
  xl: "w-12 h-12",
  "2xl": "w-16 h-16",
};

// Central logo asset path – stored under client/public so it is served
// as a public static asset by Vite and the production server.
// Use a square-safe mark for icon containers to prevent crop/clip artifacts.
const BRAND_LOGO_URL = "/tradescout-logo-circle.png?v=1";
const FALLBACK_LOGO_URL = "/tradescout-logo.png?v=8";

export function TradeScoutLogo({ className = "", size = "md" }: IconProps) {
  const sizeClass = sizeClasses[size];
  const [logoSrc, setLogoSrc] = React.useState(BRAND_LOGO_URL);

  return (
    <span
      className={`${sizeClass} ${className} inline-flex items-center justify-center rounded-full overflow-hidden bg-black/20 ring-1 ring-white/10`}
    >
      <img
        src={logoSrc}
        alt="TradeScout logo"
        className="h-full w-full object-contain"
        loading="lazy"
        decoding="async"
        onError={() => {
          if (logoSrc !== FALLBACK_LOGO_URL) setLogoSrc(FALLBACK_LOGO_URL);
        }}
      />
    </span>
  );
}

// Enhanced Simplified Icon for Favicons and Small Spaces
export function TradeScoutIcon({ className = "", size = "md", variant = "standard" }: IconProps) {
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
      <rect
        width="100"
        height="100"
        fill={variant === "gradient" ? "url(#iconGradient)" : "currentColor"}
        rx="20"
      />

      {/* Simplified Hammer Icon */}
      <g transform="translate(50,50)" fill="white">
        {/* Clean hammer head */}
        <rect x="-15" y="-6" width="18" height="8" rx="2" />
        {/* Clean handle */}
        <rect x="0" y="-3" width="20" height="6" rx="3" />
        {/* End cap */}
        <circle cx="20" cy="0" r="3" />
      </g>

      {/* Modern highlight */}
      <rect x="20" y="20" width="60" height="1" fill="rgba(255,255,255,0.3)" rx="0.5" />
    </svg>
  );
}

// Professional Brand Mark with Text
export function TradeScoutBrand({
  className = "",
  size = "lg",
  showText = true,
}: IconProps & { showText?: boolean }) {
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
          <span className="text-xs text-white/60 font-medium leading-tight">
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
    <svg viewBox="0 0 100 100" className={`${sizeClasses[props.size || "md"]} ${props.className}`}>
      <circle
        cx="50"
        cy="50"
        r="45"
        fill="currentColor"
        opacity="0.1"
        stroke="currentColor"
        strokeWidth="2"
      />
      <g transform="translate(50,50)">
        <rect x="-20" y="-8" width="25" height="12" fill="currentColor" rx="3" />
        <rect x="2" y="-4" width="30" height="8" fill="currentColor" rx="4" />
        <path d="M-18 -8 Q-22 -12 -25 -8 Q-22 -4 -18 -2" fill="currentColor" />
        <circle cx="32" cy="0" r="4" fill="currentColor" />
      </g>
    </svg>
  ),

  wrench: (props: IconProps) => (
    <svg viewBox="0 0 100 100" className={`${sizeClasses[props.size || "md"]} ${props.className}`}>
      <circle
        cx="50"
        cy="50"
        r="45"
        fill="currentColor"
        opacity="0.1"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M30 25 Q25 25 25 30 L25 40 Q25 45 30 45 L35 45 L45 55 L55 45 L60 45 Q65 45 65 40 L65 30 Q65 25 60 25 Z"
        fill="currentColor"
      />
      <rect x="45" y="50" width="10" height="25" fill="currentColor" rx="3" />
      <circle cx="45" cy="35" r="3" fill="rgba(255,255,255,0.3)" />
    </svg>
  ),

  drill: (props: IconProps) => (
    <svg viewBox="0 0 100 100" className={`${sizeClasses[props.size || "md"]} ${props.className}`}>
      <circle
        cx="50"
        cy="50"
        r="45"
        fill="currentColor"
        opacity="0.1"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect x="25" y="40" width="40" height="15" fill="currentColor" rx="7" />
      <rect x="65" y="45" width="8" height="5" fill="currentColor" rx="2" />
      <circle cx="30" cy="47.5" r="3" fill="rgba(255,255,255,0.4)" />
      <rect x="73" y="46" width="4" height="3" fill="currentColor" />
    </svg>
  ),

  level: (props: IconProps) => (
    <svg viewBox="0 0 100 100" className={`${sizeClasses[props.size || "md"]} ${props.className}`}>
      <circle
        cx="50"
        cy="50"
        r="45"
        fill="currentColor"
        opacity="0.1"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect x="20" y="45" width="60" height="10" fill="currentColor" rx="5" />
      <circle cx="50" cy="50" r="6" fill="rgba(255,255,255,0.4)" />
      <circle cx="50" cy="50" r="2" fill="currentColor" />
    </svg>
  ),

  hardhat: (props: IconProps) => (
    <svg viewBox="0 0 100 100" className={`${sizeClasses[props.size || "md"]} ${props.className}`}>
      <circle
        cx="50"
        cy="50"
        r="45"
        fill="currentColor"
        opacity="0.1"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M20 55 Q20 35 50 35 Q80 35 80 55 L75 65 L25 65 Z" fill="currentColor" />
      <rect x="47" y="30" width="6" height="8" fill="currentColor" />
      <rect x="20" y="65" width="60" height="6" fill="currentColor" rx="3" />
      <rect x="45" y="42" width="10" height="2" fill="rgba(255,255,255,0.3)" />
    </svg>
  ),
};

// Icon Selector Component
export function TradeScoutIconSelector({
  type,
  ...props
}: IconProps & { type: "logo" | "icon" | "brand" | keyof typeof constructionIcons }) {
  switch (type) {
    case "logo":
      return <TradeScoutLogo {...props} />;
    case "icon":
      return <TradeScoutIcon {...props} />;
    case "brand":
      return <TradeScoutBrand {...props} />;
    default:
      if (type in constructionIcons) {
        const IconComponent = constructionIcons[type as keyof typeof constructionIcons];
        return <IconComponent {...props} />;
      }
      return <TradeScoutLogo {...props} />;
  }
}
