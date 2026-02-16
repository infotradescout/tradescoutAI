import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, ArrowRight } from "lucide-react";

export default function ClaimMyBusinessPage() {
  const [location, navigate] = useLocation();

  const slug = useMemo(() => {
    try {
      const idx = location.indexOf("?");
      if (idx === -1) return "";
      const params = new URLSearchParams(location.slice(idx + 1));
      return String(params.get("slug") || "").trim();
    } catch {
      return "";
    }
  }, [location]);

  useEffect(() => {
    if (!slug) return;
    // Keep the legacy entry point but route users into the single signup surface.
    navigate(
      `/pre-scout-setup?mode=create&claim=${encodeURIComponent(slug)}&next=${encodeURIComponent(
        "/pre-scout-setup"
      )}`
    );
  }, [navigate, slug]);

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <Card className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Building2 className="h-5 w-5 text-orange-400" />
            Claim My Business
          </CardTitle>
          <CardDescription className="text-[color:var(--text-secondary)]">
            Claim during signup. Finish profile and verification after.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!slug ? (
            <div className="text-sm text-slate-300">
              Open this page from a business profile (it needs a `slug`).
            </div>
          ) : null}

          <Button
            className="bg-orange-500 hover:bg-orange-600 w-full"
            onClick={() =>
              navigate(`/pre-scout-setup?mode=create&claim=${encodeURIComponent(slug)}`)
            }
            disabled={!slug}
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            Continue to signup
          </Button>

          <div className="text-xs text-[color:var(--text-secondary)]">
            We match and attach using your signup email/phone.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
