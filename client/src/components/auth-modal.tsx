import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { X, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { buildAuthEntryRoute } from "@/lib/postOnboardingRoute";

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
  title = "Join TradeScout",
  description = "Find local help or grow your business.",
  trigger = "unknown",
  showGuestOption = true,
  onGuestContinue,
}: AuthModalProps) {
  const [, navigate] = useLocation();
  const [providers, setProviders] = useState<{ google: boolean; facebook: boolean }>({
    google: false,
    facebook: false,
  });
  const apiBaseUrl = (
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    ""
  ).replace(/\/$/, "");
  const oauthHref = (provider: "google" | "facebook", mode: "create" | "signin" = "create") => {
    const next = encodeURIComponent(buildAuthEntryRoute({ mode }));
    return `${apiBaseUrl}/api/auth/${provider}?next=${next}`;
  };

  useEffect(() => {
    let alive = true;
    apiRequest("GET", "/api/auth/providers")
      .then((json) => {
        if (!alive) return;
        if (json && typeof json.google === "boolean" && typeof json.facebook === "boolean") {
          setProviders({ google: json.google, facebook: json.facebook });
          return;
        }
        setProviders({ google: false, facebook: false });
      })
      .catch(() => {
        if (!alive) return;
        setProviders({ google: false, facebook: false });
      });
    return () => {
      alive = false;
    };
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-tsBg border-white/10 max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-white text-xl">{title}</DialogTitle>
              <DialogDescription className="text-white/70 mt-1">{description}</DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white/60 hover:text-white hover:bg-tsCard"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          {/* OAuth Buttons */}
          {(providers.facebook || providers.google) && (
            <>
              <div className="space-y-2">
                {providers.facebook && (
                  <Button
                    type="button"
                    onClick={() => (window.location.href = oauthHref("facebook", "create"))}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-6"
                  >
                    <Facebook className="w-5 h-5 mr-3" />
                    Continue with Facebook
                  </Button>
                )}

                {providers.google && (
                  <Button
                    type="button"
                    onClick={() => (window.location.href = oauthHref("google", "create"))}
                    variant="outline"
                    className="w-full border-white/10 text-white/70 hover:bg-tsCard font-medium py-6"
                  >
                    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </Button>
                )}
              </div>

              <div className="relative">
                <Separator className="bg-tsCard" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="bg-tsBg px-3 text-sm text-white/60">or</span>
                </div>
              </div>
            </>
          )}

          {/* Email Options */}
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                navigate(buildAuthEntryRoute({ mode: "create" }));
              }}
            >
              Create account with email
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-white/60 hover:text-white"
              onClick={() => {
                navigate(buildAuthEntryRoute({ mode: "signin" }));
              }}
            >
              Already have an account? Sign in
            </Button>
          </div>

          {/* Guest Option */}
          {showGuestOption && (
            <>
              <div className="relative">
                <Separator className="bg-tsCard" />
              </div>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-white/60 hover:text-white"
                onClick={() => {
                  onGuestContinue?.();
                  onClose();
                }}
              >
                Continue as guest (limited access)
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
