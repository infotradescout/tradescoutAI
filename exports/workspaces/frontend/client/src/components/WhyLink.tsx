import React from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

export interface WhyLinkProps {
  to: string;
  label?: string;
  className?: string;
}

export function WhyLink({ to, label = "Why?", className }: WhyLinkProps) {
  const [, navigate] = useLocation();

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    navigate(to);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex items-center text-[11px] font-medium text-ts-orange hover:text-ts-orange underline-offset-2 hover:underline",
        className,
      )}
    >
      {label}
    </button>
  );
}
