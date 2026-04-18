import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Facebook, User, UserPlus, LogIn } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

interface AuthButtonsProps {
  title?: string;
  description?: string;
  showSignUp?: boolean;
  showGuestOption?: boolean;
  onGuestContinue?: () => void;
  className?: string;
}

export function AuthButtons({
  title = "Join TradeScout",
  description = "Connect with verified contractors or grow your business",
  showSignUp = true,
  showGuestOption = true,
  onGuestContinue,
  className = "",
}: AuthButtonsProps) {
  const [, setLocation] = useLocation();
  const apiBaseUrl = (
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    ""
  ).replace(/\/$/, "");

  const [providers, setProviders] = useState<{ google: boolean; facebook: boolean }>(() => ({
    google: false,
    facebook: false,
  }));
  const oauthHref = (provider: "google" | "facebook", mode: "create" | "signin" = "create") => {
    const next = encodeURIComponent(`/pre-scout-setup?mode=${mode}`);
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
  }, []);

  const handleFacebookLogin = () => {
    // Join flows default to create mode while preserving OAuth compatibility.
    window.location.href = oauthHref("facebook", "create");
  };

  const handleGoogleLogin = () => {
    window.location.href = oauthHref("google", "create");
  };

  const handleEmailSignUp = () => {
    setLocation("/pre-scout-setup?mode=create");
  };

  const handleEmailLogin = () => {
    setLocation("/pre-scout-setup?mode=signin");
  };

  return (
    <Card className={`bg-tsCard border-white/10 ${className}`}>
      <CardHeader className="text-center">
        <CardTitle className="text-white text-xl">{title}</CardTitle>
        <CardDescription className="text-white/70">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Social Login Buttons */}
        <div className="space-y-2 md:space-y-3">
          {providers.facebook ? (
            <Button
              onClick={handleFacebookLogin}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 md:py-6 text-sm md:text-base"
            >
              <Facebook className="w-5 h-5 mr-3" />
              Continue with Facebook
            </Button>
          ) : null}

          {providers.google ? (
            <Button
              onClick={handleGoogleLogin}
              variant="outline"
              className="w-full border-white/15 text-white/70 hover:bg-white/10 font-medium py-3 md:py-6 text-sm md:text-base"
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
          ) : null}
        </div>

        {/* Divider */}
        <div className="relative">
          <Separator className="bg-tsCard" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="bg-tsCard px-3 text-sm text-white/60">or</span>
          </div>
        </div>

        {/* Email Options */}
        <div className="space-y-3">
          {showSignUp && (
            <Button
              onClick={handleEmailSignUp}
              className="w-full bg-ts-orange hover:bg-ts-orange-dark text-white font-medium py-6 text-base"
            >
              <UserPlus className="w-5 h-5 mr-3" />
              Create Account with Email
            </Button>
          )}

          <Button
            onClick={handleEmailLogin}
            variant="outline"
            className="w-full border-white/10 text-white/70 hover:bg-tsCard font-medium py-6 text-base"
          >
            <LogIn className="w-5 h-5 mr-3" />
            Sign In with Email
          </Button>
        </div>

        {/* Guest Option */}
        {showGuestOption && (
          <>
            <div className="relative">
              <Separator className="bg-tsCard" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="bg-tsCard px-3 text-sm text-white/60">or</span>
              </div>
            </div>

            <Button
              variant="ghost"
              onClick={onGuestContinue}
              className="w-full text-white/60 hover:text-white hover:bg-tsCard py-4"
            >
              Continue as Guest
              <span className="text-xs ml-2">(Limited access)</span>
            </Button>
          </>
        )}

        {/* Terms */}
        <p className="text-xs text-white/60 text-center leading-relaxed">
          By continuing, you agree to TradeScout's{" "}
          <a href="/terms" className="text-ts-orange hover:text-ts-orange">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/privacy" className="text-ts-orange hover:text-ts-orange">
            Privacy Policy
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
