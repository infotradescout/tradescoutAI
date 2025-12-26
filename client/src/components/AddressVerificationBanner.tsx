import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, MapPin, CheckCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Shield, ExternalLink } from "lucide-react";
import { useAddressVerification } from "@/hooks/useAddressVerification";

export function AddressVerificationBanner() {
  try {
    const [dismissed, setDismissed] = useState(false);
    const {
      isLoading,
      isVerified,
      requiresVerification,
      daysRemaining,
      isExpired,
      needsUrgentAction
    } = useAddressVerification();

    // Don't show banner if loading, verified, dismissed, or no verification required
    if (isLoading || isVerified || dismissed || !requiresVerification) {
      return null;
    }

    const getAlertVariant = () => {
      if (isExpired) return "destructive";
      if (needsUrgentAction) return "default"; // Will be styled as warning
      return "default";
    };

    const getAlertClasses = () => {
      if (isExpired) return "border-red-200 bg-red-50 dark:bg-red-950";
      if (needsUrgentAction) return "border-orange-200 bg-orange-50 dark:bg-orange-950";
      return "border-blue-200 bg-blue-50 dark:bg-blue-950";
    };

    const getIconColor = () => {
      if (isExpired) return "text-red-600 dark:text-red-400";
      if (needsUrgentAction) return "text-orange-600 dark:text-orange-400";
      return "text-blue-600 dark:text-blue-400";
    };

    const getTitleColor = () => {
      if (isExpired) return "text-red-800 dark:text-red-200";
      if (needsUrgentAction) return "text-orange-800 dark:text-orange-200";
      return "text-blue-800 dark:text-blue-200";
    };

    const getDescriptionColor = () => {
      if (isExpired) return "text-red-700 dark:text-red-300";
      if (needsUrgentAction) return "text-orange-700 dark:text-orange-300";
      return "text-blue-700 dark:text-blue-300";
    };

    return (
      <div className="sticky top-0 z-50">
        <Alert className={`rounded-none border-x-0 ${getAlertClasses()}`}>
          <Shield className={`h-4 w-4 ${getIconColor()}`} />
          <div className="flex items-center justify-between w-full">
            <div className="flex-1">
              <AlertTitle className={`flex items-center gap-2 ${getTitleColor()}`}>
                Address Verification Required
                {needsUrgentAction && (
                  <Badge variant="error" className="text-xs">
                    Urgent
                  </Badge>
                )}
                {isExpired && (
                  <Badge variant="error" className="text-xs">
                    Overdue
                  </Badge>
                )}
              </AlertTitle>
              <AlertDescription className={getDescriptionColor()}>
                {isExpired ? (
                  "Your verification deadline has passed. Complete verification to regain full access."
                ) : needsUrgentAction ? (
                  `Only ${daysRemaining} days left to verify your address. Don't lose access to platform features.`
                ) : (
                  `You have ${daysRemaining} days to verify your address. Complete verification to avoid access restrictions.`
                )}
              </AlertDescription>
            </div>

            <div className="flex items-center gap-2 ml-4">
              <Link href="/address-verification">
                <Button
                  variant={isExpired || needsUrgentAction ? "destructive" : "default"}
                  size="sm"
                  className="whitespace-nowrap"
                >
                  Verify Now
                  <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              </Link>

              {!isExpired && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDismissed(true)}
                  className={`p-1 h-6 w-6 ${getIconColor()}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </Alert>
      </div>
    );
  } catch (error) {
    console.error("Error in AddressVerificationBanner:", error);
    return null; // Render nothing or a fallback UI
  }
}