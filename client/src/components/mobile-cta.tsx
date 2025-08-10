import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import QuoteForm from "./quote-form";
import { Users, Phone, Calculator, ArrowUp, X } from "lucide-react";

// Pages where the mobile CTA should appear
const CTA_PAGES = [
  '/',
  '/contractors/board',
  '/counties/',
  '/contractors/',
  '/quote'
];

// Different CTA types based on page
const getCTAConfig = (location: string) => {
  if (location.startsWith('/contractors/') && !location.includes('/board')) {
    return {
      type: 'contractor-profile',
      text: 'Get Quote from This Contractor',
      icon: Phone,
      color: 'bg-orange-500 hover:bg-orange-600'
    };
  }
  
  if (location === '/quote') {
    return {
      type: 'quote-calculator',
      text: 'Get 3 Free Estimates',
      icon: Users,
      color: 'bg-orange-500 hover:bg-orange-600'
    };
  }
  
  return {
    type: 'general',
    text: 'Get 3 Free Quotes',
    icon: Users,
    color: 'bg-orange-500 hover:bg-orange-600'
  };
};

export default function MobileCTA() {
  const [location] = useLocation();
  const { isAuthenticated } = useAuth();
  const [isQuoteSheetOpen, setIsQuoteSheetOpen] = useState(false);
  const [showCTA, setShowCTA] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  // Check if CTA should be shown on current page
  const shouldShowCTA = CTA_PAGES.some(page => 
    location === page || location.startsWith(page)
  );

  // Handle scroll to show/hide CTA
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const updateScrollDirection = () => {
      const scrollY = window.scrollY;
      
      if (Math.abs(scrollY - lastScrollY) < 10) {
        ticking = false;
        return;
      }
      
      setIsVisible(scrollY < lastScrollY || scrollY < 100);
      lastScrollY = scrollY;
      ticking = false;
    };

    const requestTick = () => {
      if (!ticking) {
        requestAnimationFrame(updateScrollDirection);
        ticking = true;
      }
    };

    const onScroll = () => requestTick();
    
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Show CTA after a brief delay
  useEffect(() => {
    if (shouldShowCTA) {
      const timer = setTimeout(() => setShowCTA(true), 1000);
      return () => clearTimeout(timer);
    } else {
      setShowCTA(false);
    }
  }, [location, shouldShowCTA]);

  if (!showCTA || !shouldShowCTA) {
    return null;
  }

  const ctaConfig = getCTAConfig(location);
  const IconComponent = ctaConfig.icon;

  return (
    <>
      {/* Mobile CTA Button */}
      <div 
        className={`fixed bottom-0 left-0 right-0 z-50 md:hidden transition-transform duration-300 ${
          isVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="bg-navy-800/95 backdrop-blur-sm border-t border-navy-600 p-4">
          <Sheet open={isQuoteSheetOpen} onOpenChange={setIsQuoteSheetOpen}>
            <SheetTrigger asChild>
              <Button 
                className={`w-full ${ctaConfig.color} text-white py-4 rounded-lg font-semibold glow-effect transition-all duration-300 shadow-lg`}
              >
                <IconComponent className="h-5 w-5 mr-2" />
                {ctaConfig.text}
              </Button>
            </SheetTrigger>
            
            <SheetContent 
              side="bottom" 
              className="bg-navy-800 border-navy-600 max-h-[90vh] overflow-y-auto"
            >
              <SheetHeader className="text-left mb-6">
                <SheetTitle className="text-white text-xl">
                  {ctaConfig.type === 'contractor-profile' 
                    ? 'Contact This Contractor' 
                    : 'Get Free Estimates'
                  }
                </SheetTitle>
              </SheetHeader>
              
              <QuoteForm 
                onSuccess={() => setIsQuoteSheetOpen(false)}
                compact={true}
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Scroll to top button (shows when CTA is hidden) */}
      {!isVisible && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-40 md:hidden w-12 h-12 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-300 glow-effect"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
    </>
  );
}
