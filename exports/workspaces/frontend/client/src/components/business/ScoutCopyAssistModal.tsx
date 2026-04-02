/**
 * ScoutCopyAssistModal
 *
 * Modal dialog showing 2 read-only copy variants with explicit "Use this" acceptance.
 *
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - variants: ScoutCopyVariant[]
 * - currentDescription: string
 * - onAccept: (variantId: "safe" | "growth") => void
 * - isLoading?: boolean
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Sparkles } from "lucide-react";
import type { ScoutCopyVariant } from "@/agent/tools/scoutCopyAssist";
import { recordCopyAssistTelemetry } from "@/agent/tools/scoutCopyAssist";

interface ScoutCopyAssistModalProps {
  isOpen: boolean;
  onClose: () => void;
  variants: ScoutCopyVariant[];
  currentDescription: string;
  onAccept: (variantId: "safe" | "growth") => void;
  isLoading?: boolean;
  field?: "description" | "headline" | "services";
}

export function ScoutCopyAssistModal({
  isOpen,
  onClose,
  variants,
  currentDescription,
  onAccept,
  isLoading = false,
  field = "description",
}: ScoutCopyAssistModalProps) {
  const handleClose = () => {
    recordCopyAssistTelemetry("closed");
    onClose();
  };

  const handleAccept = (variantId: "safe" | "growth") => {
    recordCopyAssistTelemetry("accepted", variantId);
    onAccept(variantId);
    handleClose();
  };

  const safeVariant = variants.find((v) => v.id === "safe");
  const growthVariant = variants.find((v) => v.id === "growth");

  const fieldLabels = {
    description: "Description",
    headline: "Headline",
    services: "Services",
  };

  const fieldLabel = fieldLabels[field] || "Description";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            Scout {fieldLabel} Suggestions
          </DialogTitle>
          <DialogDescription>
            Choose a variant to improve your {fieldLabel.toLowerCase()}. Changes are not
            automatic—you must explicitly accept one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Description (Read-Only) */}
          {currentDescription && (
            <div className="bg-muted rounded-lg p-4 border border-muted-foreground/20">
              <p className="text-sm font-medium mb-2">Your current description</p>
              <p className="text-sm text-muted-foreground">{currentDescription}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {currentDescription.length} characters
              </p>
            </div>
          )}

          {/* Variants */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Safe Variant */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Safe</Badge>
                <p className="text-xs text-muted-foreground">Clarity-first</p>
              </div>
              <div className="bg-muted/50 rounded p-3 min-h-[100px] flex flex-col justify-between">
                <p className="text-sm">{safeVariant?.text}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {safeVariant?.text?.length || 0} characters
                </p>
              </div>
              <p className="text-xs text-muted-foreground italic">
                Rationale: {safeVariant?.rationale}
              </p>
              <Button
                onClick={() => handleAccept("safe")}
                variant="outline"
                className="w-full"
                disabled={isLoading}
              >
                Use this
              </Button>
            </div>

            {/* Growth Variant */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="default">Growth</Badge>
                <p className="text-xs text-muted-foreground">Benefits-led</p>
              </div>
              <div className="bg-muted/50 rounded p-3 min-h-[100px] flex flex-col justify-between">
                <p className="text-sm">{growthVariant?.text}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {growthVariant?.text?.length || 0} characters
                </p>
              </div>
              <p className="text-xs text-muted-foreground italic">
                Rationale: {growthVariant?.rationale}
              </p>
              <Button
                onClick={() => handleAccept("growth")}
                variant="default"
                className="w-full"
                disabled={isLoading}
              >
                Use this
              </Button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button onClick={handleClose} variant="ghost" size="sm">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
