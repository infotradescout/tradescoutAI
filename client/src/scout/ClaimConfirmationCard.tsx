/**
 * ClaimConfirmationCard Component
 * Checkbox UI for confirming what the user is looking for
 *
 * Contract:
 * - Renders 1-5 claim options as checkboxes
 * - Top 1-2 high-confidence options pre-checked
 * - Submit returns selected claimTypes array
 * - Skip/Edit secondary actions available
 */

import React, { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { ClaimConfirmationCard as ClaimConfirmationCardData, ClaimType } from "./claimTypes";

interface ClaimConfirmationCardProps {
  data: ClaimConfirmationCardData;
  onConfirm: (selectedClaims: ClaimType[]) => void;
  onSkip: () => void;
  onEdit?: () => void;
}

export function ClaimConfirmationCard({
  data,
  onConfirm,
  onSkip,
  onEdit,
}: ClaimConfirmationCardProps) {
  const [selectedClaims, setSelectedClaims] = useState<Set<ClaimType>>(
    new Set(data.options.filter((opt) => opt.defaultChecked).map((opt) => opt.claimType))
  );

  const handleToggle = (claimType: ClaimType, checked: boolean) => {
    setSelectedClaims((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(claimType);
      } else {
        next.delete(claimType);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const claims = Array.from(selectedClaims);
    onConfirm(claims);
  };

  return (
    <Card className="w-full max-w-2xl border-primary/20 bg-card/95 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">{data.title}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">{data.preface}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {data.options.map((option) => {
          const isChecked = selectedClaims.has(option.claimType);

          return (
            <div
              key={option.id}
              className="flex items-start space-x-3 rounded-lg border border-border/50 p-3 hover:bg-accent/10 transition-colors"
            >
              <Checkbox
                id={option.id}
                checked={isChecked}
                onCheckedChange={(checked) => handleToggle(option.claimType, checked as boolean)}
                className="mt-1"
              />
              <div className="flex-1 space-y-1">
                <Label
                  htmlFor={option.id}
                  className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {option.label}
                </Label>
                {option.description && (
                  <p className="text-xs text-muted-foreground leading-snug">{option.description}</p>
                )}
                {option.confidence >= 0.8 && (
                  <span className="inline-flex items-center text-xs text-green-600 dark:text-green-400">
                    Likely match
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>

      <CardFooter className="flex flex-col sm:flex-row gap-2 justify-between">
        <div className="flex gap-2">
          {data.secondaryAction && onEdit && (
            <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
              {data.secondaryAction.label}
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={onSkip}>
            {data.skipAction.label}
          </Button>
        </div>

        <Button
          type="button"
          onClick={handleConfirm}
          disabled={selectedClaims.size === 0}
          className="w-full sm:w-auto"
        >
          Looks right {selectedClaims.size > 0 && `(${selectedClaims.size})`}
        </Button>
      </CardFooter>
    </Card>
  );
}
