
import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/lib/utils"

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & {
    headerHeight?: number;
    pageHeight?: number;
    scrollToTop?: boolean;
    onScrollChange?: (scrollTop: number) => void;
  }
>(({ className, children, headerHeight = 0, pageHeight, scrollToTop, onScrollChange, ...props }, ref) => {
  const viewportRef = React.useRef<HTMLDivElement>(null);

  // Handle scroll to top when requested
  React.useEffect(() => {
    if (scrollToTop && viewportRef.current) {
      viewportRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [scrollToTop]);

  // Handle scroll change events
  const handleScroll = React.useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (onScrollChange) {
      onScrollChange(event.currentTarget.scrollTop);
    }
  }, [onScrollChange]);

  const viewportStyle = React.useMemo(() => {
    const style: React.CSSProperties = {};
    
    if (headerHeight > 0) {
      style.paddingTop = `${headerHeight}px`;
    }
    
    if (pageHeight) {
      style.height = `${pageHeight}px`;
      style.maxHeight = `${pageHeight}px`;
    }
    
    return style;
  }, [headerHeight, pageHeight]);

  return (
    <ScrollAreaPrimitive.Root
      ref={ref}
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport 
        ref={viewportRef}
        className="h-full w-full rounded-[inherit]"
        style={viewportStyle}
        onScroll={handleScroll}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
})
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" &&
        "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" &&
        "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }
