import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AuthButtons } from "./auth-buttons";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  trigger?: string; // Track what triggered the modal for analytics
  showGuestOption?: boolean;
  onGuestContinue?: () => void;
}

export function AuthModal({ 
  isOpen, 
  onClose, 
  title = "Join Trade Scout Today",
  description = "Get started with finding contractors or growing your business",
  trigger = "unknown",
  showGuestOption = true,
  onGuestContinue
}: AuthModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-navy-900 border-navy-700 max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-white text-xl">{title}</DialogTitle>
              <DialogDescription className="text-gray-300 mt-1">
                {description}
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white hover:bg-navy-700"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="mt-4">
          <AuthButtons 
            title=""
            description=""
            showGuestOption={showGuestOption}
            onGuestContinue={() => {
              onGuestContinue?.();
              onClose();
            }}
            className="bg-transparent border-0 shadow-none"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}