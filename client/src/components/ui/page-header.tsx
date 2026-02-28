import { ReactNode } from "react";
import Navigation from "./navigation";

interface PageHeaderProps {
  children?: ReactNode;
  showNavigation?: boolean;
}

export function PageHeader({ children, showNavigation = true }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-tsCard/95 backdrop-blur-sm border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="text-2xl font-bold text-white">
              Trade<span className="text-ts-orange">Scout</span>
            </div>
          </div>

          {/* Custom content */}
          {children}

          {/* Navigation */}
          {showNavigation && <Navigation />}
        </div>
      </div>
    </header>
  );
}