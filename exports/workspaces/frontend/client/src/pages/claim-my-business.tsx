import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StateCountySelector } from "@/components/state-county-selector";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Building2, ArrowRight, Search, ShieldCheck } from "lucide-react";

type CountyLite = { fips: string; stateCode: string; name: string };
type ClaimSearchItem = {
  id: string;
  name: string;
  slug: string;
  type?: string;
  status?: string;
  claimStatus?: string;
  counties?: CountyLite[];
};

function parseQuery(location: string): URLSearchParams {
  try {
    const idx = location.indexOf("?");
    if (idx === -1) return new URLSearchParams();
    return new URLSearchParams(location.slice(idx + 1));
  } catch {
    return new URLSearchParams();
  }
}

export default function ClaimMyBusinessPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();

  const params = useMemo(() => parseQuery(location), [location]);
  const initialSlug = String(params.get("slug") || "").trim();
  const initialBusinessId = String(params.get("businessId") || "").trim();

  const [stateCode, setStateCode] = useState(String(params.get("stateCode") || "").trim());
  const [countyFips, setCountyFips] = useState(String(params.get("countyFips") || "").trim());
  const [q, setQ] = useState(String(params.get("q") || "").trim());

  const [resolved, setResolved] = useState<ClaimSearchItem | null>(null);
  const [resolving, setResolving] = useState(false);

  const [items, setItems] = useState<ClaimSearchItem[]>([]);
  const [searching, setSearching] = useState(false);

  const [creating, setCreating] = useState(false);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    const slug = initialSlug;
    if (!slug || initialBusinessId) return;

    setResolving(true);
    fetch(`/api/business-claim/resolve?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const biz = data?.business;
        if (biz?.id && biz?.slug) {
          setResolved(biz as ClaimSearchItem);
        }
      })
      .catch(() => null)
      .finally(() => setResolving(false));
  }, [initialSlug, initialBusinessId]);

  const selectedBusinessId = initialBusinessId || resolved?.id || "";

  const runSearch = async () => {
    if (q.trim().length < 2) {
      toast({ title: "Type at least 2 characters", description: "Search by business name." });
      return;
    }
    setSearching(true);
    try {
      const sp = new URLSearchParams({ q: q.trim(), limit: "10" });
      if (stateCode) sp.set("stateCode", stateCode);
      if (countyFips) sp.set("countyFips", countyFips);
      const res = await fetch(`/api/business-claim/search?${sp.toString()}`);
      const data = res.ok ? await res.json() : null;
      setItems(Array.isArray(data?.items) ? (data.items as ClaimSearchItem[]) : []);
    } catch (e: any) {
      toast({ title: "Search failed", description: e?.message || "Please try again." });
    } finally {
      setSearching(false);
    }
  };

  const startSignupWithClaim = (businessId: string) => {
    const sp = new URLSearchParams();
    sp.set("mode", "create");
    sp.set("claimBusinessId", businessId);
    sp.set("next", `/claim-my-business?businessId=${encodeURIComponent(businessId)}`);
    if (stateCode) sp.set("stateCode", stateCode);
    if (countyFips) sp.set("countyFips", countyFips);
    navigate(`/pre-scout-setup?${sp.toString()}`);
  };

  const startSigninWithClaim = (businessId: string) => {
    const sp = new URLSearchParams();
    sp.set("mode", "signin");
    sp.set("claimBusinessId", businessId);
    sp.set("next", `/claim-my-business?businessId=${encodeURIComponent(businessId)}`);
    if (stateCode) sp.set("stateCode", stateCode);
    if (countyFips) sp.set("countyFips", countyFips);
    navigate(`/pre-scout-setup?${sp.toString()}`);
  };

  const claimNow = async (businessId: string) => {
    if (!businessId) return;
    setClaiming(true);
    try {
      const result = await apiRequest("POST", "/api/business-claim/claim", { businessId });
      toast({ title: "Claimed", description: "Business attached to your account." });
      if (result?.slug) {
        navigate(`/business/${encodeURIComponent(result.slug)}/edit`);
      } else {
        navigate("/settings");
      }
    } catch (e: any) {
      const code = String(e?.code || "");
      toast({
        title: "Claim blocked",
        description:
          code === "CLAIM_NOT_VERIFIED"
            ? "Your account email/phone did not match the business on file."
            : e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setClaiming(false);
    }
  };

  const createAndClaim = async () => {
    const name = q.trim();
    if (name.length < 2) {
      toast({ title: "Missing business name", description: "Type a business name first." });
      return;
    }
    if (!stateCode || !countyFips) {
      toast({ title: "Missing county", description: "Select a state and county first." });
      return;
    }

    setCreating(true);
    try {
      const result = await apiRequest("POST", "/api/business-claim/find-or-create", {
        name,
        stateCode,
        countyFips,
        type: "contractor",
        roleContext: "contractor",
      });
      const biz = result?.business as ClaimSearchItem | undefined;
      if (!biz?.id) throw new Error("Failed to create business shell");
      toast({
        title: result?.created ? "Created" : "Already listed",
        description: "Continue to claim this business.",
      });
      startSignupWithClaim(biz.id);
    } catch (e: any) {
      toast({
        title: "Create failed",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const countyLabel = (counties?: CountyLite[]) => {
    const first = Array.isArray(counties) ? counties[0] : null;
    return first ? `${first.name}, ${first.stateCode}` : "Unknown county";
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-white">
      <Card className="rounded-2xl border border-white/10 bg-tsCard/95 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-white">
            <Building2 className="h-5 w-5 text-ts-orange" />
            Claim a Business Profile
          </CardTitle>
          <CardDescription className="text-white/60">
            Businesses can exist on TradeScout before an owner signs up. Claiming attaches the
            profile to your account.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Resolve view (from /business/:slug) */}
          {initialSlug && !initialBusinessId ? (
            <div className="rounded-xl border border-white/10 bg-black/25 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-[0.14em] text-white/60">
                    From business profile
                  </div>
                  <div className="mt-1 font-semibold text-white truncate">
                    {resolved?.name || initialSlug}
                  </div>
                  <div className="text-xs text-white/60">
                    {resolved?.counties
                      ? countyLabel(resolved.counties)
                      : resolving
                        ? "Loading…"
                        : ""}
                  </div>
                </div>

                <Button
                  variant="outline"
                  disabled={!resolved?.id || resolving}
                  onClick={() => {
                    const id = resolved?.id || "";
                    if (!id) return;
                    if (isAuthenticated) void claimNow(id);
                    else startSignupWithClaim(id);
                  }}
                >
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  {isAuthenticated ? (claiming ? "Claiming…" : "Claim now") : "Continue"}
                </Button>
              </div>
            </div>
          ) : null}

          {/* Search */}
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                Primary county
              </Label>
              <StateCountySelector
                selectedState={stateCode}
                selectedCounty={countyFips}
                onStateChange={setStateCode}
                onCountyChange={setCountyFips}
                className="gap-2"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                Business name
              </Label>
              <div className="flex gap-2">
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search your business"
                  className="h-10 border-white/10 bg-black/30 text-white placeholder:text-white/60 focus-visible:ring-ts-orange/70"
                />
                <Button onClick={runSearch} disabled={searching}>
                  <Search className="h-4 w-4 mr-2" />
                  {searching ? "Searching…" : "Search"}
                </Button>
              </div>
              <p className="text-xs text-white/60">
                If you don’t see your business, you can create a listing and claim it.
              </p>
            </div>
          </div>

          {items.length > 0 ? (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate">{item.name}</div>
                    <div className="text-xs text-white/60">{countyLabel(item.counties)}</div>
                    <div className="text-[11px] text-white/60">/business/{item.slug}</div>
                  </div>
                  <div className="flex gap-2">
                    {isAuthenticated ? (
                      <Button
                        variant="outline"
                        disabled={claiming}
                        onClick={() => void claimNow(item.id)}
                      >
                        <ShieldCheck className="h-4 w-4 mr-2" />
                        {claiming ? "Claiming…" : "Claim"}
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" onClick={() => startSigninWithClaim(item.id)}>
                          Sign in
                        </Button>
                        <Button onClick={() => startSignupWithClaim(item.id)}>
                          <ArrowRight className="h-4 w-4 mr-2" />
                          Sign up
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="min-w-0">
              <div className="font-semibold text-white flex items-center gap-2">
                <Search className="h-4 w-4 text-ts-orange" />
                Not listed?
              </div>
              <div className="text-xs text-white/60">
                Create a claimable shell now. You can fill details and verification after claiming.
              </div>
            </div>
            <Button onClick={createAndClaim} disabled={creating}>
              {creating ? "Creating…" : "Create + claim"}
            </Button>
          </div>

          {isAuthenticated && selectedBusinessId ? (
            <div className="text-xs text-white/60">
              Signed in as {String(user?.email || "").trim() || "your account"}.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
