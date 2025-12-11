import React from "react";
import { X } from "lucide-react";
import { useLocation } from "wouter";
import { RightToolsPanel } from "../components/layout/RightToolsPanel";

interface ScoutToolsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ScoutToolsDrawer({ isOpen, onClose }: ScoutToolsDrawerProps) {
  const [, navigate] = useLocation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        className="flex-1 bg-black/50"
        aria-label="Close tools menu"
        onClick={onClose}
      />
      <div className="w-4/5 max-w-xs bg-gray-950 border-l border-gray-800 p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase tracking-wider text-gray-500">
            Tools & Personalization
          </span>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-md border border-gray-700 hover:bg-gray-800"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        <RightToolsPanel />
      </div>
    </div>
  );
}
