"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";

const CANONICAL_DEFAULT_AVATAR_SRC = "/tradescout-logo-circle.png?v=7";
const LEGACY_PLATFORM_AVATAR_PATHS = new Set<string>([
  "/tradescout-logo.png",
  "/tradescout-logo.jpg",
  "/tradescout-logo-circle.png",
  "/logo.png",
  "/favicon.ico",
  "/favicon.svg",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/favicon-48x48.png",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-192-maskable.png",
  "/icon-512.png",
  "/icon-512-maskable.png",
]);

function normalizeAvatarSource(src: unknown): string {
  if (typeof src !== "string") return CANONICAL_DEFAULT_AVATAR_SRC;
  const trimmed = src.trim();
  if (!trimmed) return CANONICAL_DEFAULT_AVATAR_SRC;
  if (trimmed.startsWith("data:")) return trimmed;

  try {
    const parsed = new URL(trimmed, "https://www.thetradescout.com");
    if (LEGACY_PLATFORM_AVATAR_PATHS.has(parsed.pathname.toLowerCase())) {
      return CANONICAL_DEFAULT_AVATAR_SRC;
    }
  } catch {
    // Fall through to string return for non-URL-like values.
  }

  return trimmed;
}

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, src, onError, ...props }, ref) => {
  const normalizedSrc = normalizeAvatarSource(src);

  const handleImageError: React.ReactEventHandler<HTMLImageElement> = (event) => {
    const image = event.currentTarget;
    if (image.dataset.fallbackApplied === "1") {
      onError?.(event);
      return;
    }
    image.dataset.fallbackApplied = "1";
    image.src = CANONICAL_DEFAULT_AVATAR_SRC;
    onError?.(event);
  };

  return (
    <AvatarPrimitive.Image
      ref={ref}
      src={normalizedSrc}
      className={cn("aspect-square h-full w-full", className)}
      onError={handleImageError}
      {...props}
    />
  );
});
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
