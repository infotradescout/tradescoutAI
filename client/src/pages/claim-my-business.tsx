import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StateCountySelector } from "@/components/state-county-selector";
import {
  GooglePlacesBusinessInput,
  type BusinessPlaceResult,
} from "@/components/GooglePlacesBusinessInput";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getOutcomeOnboardingClaimResumeRoute } from "@/lib/outcomeOnboardingClaimContinuation";
import { getCurrentInternalPath } from "@/lib/postOnboardingRoute";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { US_STATES_COUNTIES } from "@shared/states-counties";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Globe2,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
} from "lucide-react";

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

export function parseClaimQuery(location: string): URLSearchParams {
  try {
    const idx = location.indexOf("?");
    if (idx === -1) {
      if (typeof window !== "undefined" && window.location.pathname === location) {
        return new URLSearchParams(window.location.search);
      }
      return new URLSearchParams();
    }
    return new URLSearchParams(location.slice(idx + 1));
  } catch {
    return new URLSearchParams();
  }
}

function normalizeCountyName(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+(county|parish|borough|census area|municipality|district)$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findCountyFipsFromPlace(place: BusinessPlaceResult): string {
  const state = String(place.stateCode || "")
    .trim()
    .toUpperCase();
  const county = normalizeCountyName(place.countyName);
  if (!state || !county) return "";

  const stateRecord = US_STATES_COUNTIES.find((item) => item.code === state);
  const match = stateRecord?.counties.find(
    (item) =>
      normalizeCountyName(item.name) === county || normalizeCountyName(item.name).includes(county)
  );
  return match?.fipsCode || "";
}

export default function ClaimMyBusinessPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const { language } = useI18n();
  const text = (english: string, spanish: string) => (language === "es" ? spanish : english);

  const params = useMemo(() => parseClaimQuery(location), [location]);
  const initialSlug = String(params.get("slug") || "").trim();
  const initialBusinessId = String(params.get("businessId") || "").trim();

  const [stateCode, setStateCode] = useState(String(params.get("stateCode") || "").trim());
  const [countyFips, setCountyFips] = useState(String(params.get("countyFips") || "").trim());
  const [q, setQ] = useState(String(params.get("q") || "").trim());
  const [selectedPlace, setSelectedPlace] = useState<BusinessPlaceResult | null>(null);

  const [resolved, setResolved] = useState<ClaimSearchItem | null>(null);
  const [resolving, setResolving] = useState(false);

  const [items, setItems] = useState<ClaimSearchItem[]>([]);
  const [searching, setSearching] = useState(false);

  const [creating, setCreating] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const applyResolvedBusiness = (biz: ClaimSearchItem) => {
    setResolved(biz);
    if (!q.trim() && biz.name) setQ(biz.name);

    const firstCounty = Array.isArray(biz.counties) ? biz.counties[0] : null;
    if (!stateCode && firstCounty?.stateCode) setStateCode(firstCounty.stateCode);
    if (!countyFips && firstCounty?.fips) setCountyFips(firstCounty.fips);
  };

  useEffect(() => {
    const slug = initialSlug;
    const businessId = initialBusinessId;
    if (!slug && !businessId) return;

    setResolving(true);
    const sp = new URLSearchParams();
    if (businessId) sp.set("businessId", businessId);
    else sp.set("slug", slug);
    fetch(`/api/business-claim/resolve?${sp.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const biz = data?.business;
        if (biz?.id && biz?.slug) {
          applyResolvedBusiness(biz as ClaimSearchItem);
        }
      })
      .catch(() => null)
      .finally(() => setResolving(false));
  }, [initialSlug, initialBusinessId]);

  const selectedBusinessId = initialBusinessId || resolved?.id || "";

  const searchClaimableBusinesses = async (override?: {
    q?: string;
    stateCode?: string;
    countyFips?: string;
    place?: BusinessPlaceResult | null;
  }) => {
    const searchText = (override?.q ?? q).trim();
    const searchState = (override?.stateCode ?? stateCode).trim().toUpperCase();
    const searchCounty = (override?.countyFips ?? countyFips).trim();
    const place = override?.place ?? selectedPlace;
    const hasMapsSignals = Boolean(place?.placeId || place?.phone || place?.website);

    if (searchText.length < 2 && !hasMapsSignals) {
      toast({
        title: text("Type at least 2 characters", "Escribe al menos 2 caracteres"),
        description: text("Search by business name.", "Busca por nombre del negocio."),
      });
      return;
    }
    setSearching(true);
    try {
      const sp = new URLSearchParams({ q: searchText, limit: "10" });
      if (searchState) sp.set("stateCode", searchState);
      if (searchCounty) sp.set("countyFips", searchCounty);
      if (place?.placeId) sp.set("placeId", place.placeId);
      if (place?.phone) sp.set("phone", place.phone);
      if (place?.website) sp.set("website", place.website);
      const res = await fetch(`/api/business-claim/search?${sp.toString()}`);
      const data = res.ok ? await res.json() : null;
      setItems(Array.isArray(data?.items) ? (data.items as ClaimSearchItem[]) : []);
    } catch (e: any) {
      toast({
        title: text("Search failed", "Falló la búsqueda"),
        description: e?.message || text("Please try again.", "Inténtalo de nuevo."),
      });
    } finally {
      setSearching(false);
    }
  };

  const runSearch = async () => searchClaimableBusinesses();

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
      toast({
        title: text("Claimed", "Negocio reclamado"),
        description: text(
          "Business attached to your account.",
          "El negocio se vinculó a tu cuenta."
        ),
      });
      const resumeOutcomeRoute = getOutcomeOnboardingClaimResumeRoute(
        getCurrentInternalPath(location),
        businessId
      );
      if (resumeOutcomeRoute) {
        navigate(resumeOutcomeRoute);
        return;
      }
      if (result?.profileSlug) {
        navigate(`/u/${encodeURIComponent(String(result.profileSlug))}/edit`);
      } else {
        navigate("/profile-settings");
      }
    } catch (e: any) {
      const code = String(e?.code || "");
      toast({
        title: text("Claim blocked", "No se pudo reclamar"),
        description:
          code === "CLAIM_NOT_VERIFIED"
            ? text(
                "Your account email/phone did not match the business on file.",
                "El correo o teléfono de tu cuenta no coincide con el negocio registrado."
              )
            : e?.message || text("Please try again.", "Inténtalo de nuevo."),
        variant: "destructive",
      });
    } finally {
      setClaiming(false);
    }
  };

  const createAndClaim = async () => {
    const name = (selectedPlace?.businessName || q).trim();
    if (name.length < 2) {
      toast({
        title: text("Missing business name", "Falta el nombre del negocio"),
        description: text("Type a business name first.", "Escribe primero el nombre del negocio."),
      });
      return;
    }
    const nextStateCode = (stateCode || selectedPlace?.stateCode || "").trim().toUpperCase();
    const nextCountyFips =
      countyFips || (selectedPlace ? findCountyFipsFromPlace(selectedPlace) : "");
    if (!nextStateCode || (!nextCountyFips && !selectedPlace?.countyName)) {
      toast({
        title: text("Missing service area", "Falta el área de servicio"),
        description: text(
          "Select a Maps result or choose the primary county.",
          "Selecciona un resultado de Maps o el condado principal."
        ),
      });
      return;
    }

    setCreating(true);
    try {
      const result = await apiRequest("POST", "/api/business-claim/find-or-create", {
        name,
        stateCode: nextStateCode,
        ...(nextCountyFips ? { countyFips: nextCountyFips } : {}),
        type: "other",
        roleContext: "business_owner",
        ...(selectedPlace?.phone ? { phone: selectedPlace.phone } : {}),
        ...(selectedPlace?.website ? { website: selectedPlace.website } : {}),
        ...(selectedPlace
          ? {
              googlePlace: {
                businessName: selectedPlace.businessName,
                placeId: selectedPlace.placeId,
                address: selectedPlace.address,
                city: selectedPlace.city,
                stateCode: selectedPlace.stateCode,
                countyName: selectedPlace.countyName,
                phone: selectedPlace.phone,
                website: selectedPlace.website,
                lat: selectedPlace.lat,
                lng: selectedPlace.lng,
              },
            }
          : {}),
      });
      const biz = result?.business as ClaimSearchItem | undefined;
      if (!biz?.id) {
        throw new Error(
          text("Failed to create business shell", "No se pudo crear el registro del negocio")
        );
      }
      toast({
        title: result?.created
          ? text("Created from Maps", "Creado desde Maps")
          : text("Matched in TradeScout", "Coincidencia encontrada en TradeScout"),
        description: isAuthenticated
          ? text(
              "Now verifying your account against the business.",
              "Ahora verificaremos tu cuenta con el negocio."
            )
          : text("Continue account setup to claim it.", "Continúa con tu cuenta para reclamarlo."),
      });
      if (isAuthenticated) {
        await claimNow(biz.id);
      } else {
        startSignupWithClaim(biz.id);
      }
    } catch (e: any) {
      toast({
        title: text("Create failed", "No se pudo crear"),
        description: e?.message || text("Please try again.", "Inténtalo de nuevo."),
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const countyLabel = (counties?: CountyLite[]) => {
    const first = Array.isArray(counties) ? counties[0] : null;
    return first
      ? `${first.name}, ${first.stateCode}`
      : text("Unknown county", "Condado desconocido");
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 text-white sm:py-8">
      <div className="mb-3 flex justify-end">
        <LanguageSwitcher />
      </div>
      <Card className="overflow-hidden rounded-lg border border-white/10 bg-tsCard shadow-[0_16px_44px_rgba(0,0,0,0.38)]">
        <CardHeader className="space-y-1">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl text-white">
                <Building2 className="h-6 w-6 text-ts-orange" />
                {text("Claim from Google Maps", "Reclama desde Google Maps")}
              </CardTitle>
              <CardDescription className="mt-2 max-w-2xl text-sm text-white/62">
                {text(
                  "Select the Maps listing, match it to TradeScout, then verify ownership before the business attaches to your account.",
                  "Selecciona el negocio en Maps, relaciónalo con TradeScout y verifica la propiedad antes de vincularlo a tu cuenta."
                )}
              </CardDescription>
            </div>
            <div className="rounded-lg border border-ts-orange/30 bg-ts-orange/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-ts-orange">
              {text("Maps-first claim", "Reclamo desde Maps")}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { label: "1", title: text("Find on Maps", "Busca en Maps"), icon: Search },
              {
                label: "2",
                title: text("Match profile", "Relaciona el perfil"),
                icon: ClipboardCheck,
              },
              {
                label: "3",
                title: text("Verify owner", "Verifica la propiedad"),
                icon: ShieldCheck,
              },
            ].map(({ label, title, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3 rounded-lg bg-white/[0.04] p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ts-orange/15 text-xs font-bold text-ts-orange">
                  {label}
                </div>
                <div className="min-w-0">
                  <Icon className="mb-1 h-4 w-4 text-ts-orange" />
                  <div className="truncate text-sm font-semibold text-white">{title}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Resolve view (from /business/:slug) */}
          {initialSlug || initialBusinessId ? (
            <div className="rounded-xl border border-white/10 bg-black/25 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-[0.14em] text-white/60">
                    {text("From public profile", "Desde el perfil público")}
                  </div>
                  <div className="mt-1 font-semibold text-white truncate">
                    {resolved?.name || initialSlug}
                  </div>
                  <div className="text-xs text-white/60">
                    {resolved?.counties
                      ? countyLabel(resolved.counties)
                      : resolving
                        ? text("Loading…", "Cargando…")
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
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {isAuthenticated
                    ? claiming
                      ? text("Claiming…", "Reclamando…")
                      : text("Claim now", "Reclamar ahora")
                    : text("Continue", "Continuar")}
                </Button>
              </div>
            </div>
          ) : null}

          {/* Search */}
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                {text("Google Maps business", "Negocio en Google Maps")}
              </Label>
              <GooglePlacesBusinessInput
                defaultValue={q}
                placeholder={text(
                  "Search the business exactly as it appears on Google Maps",
                  "Busca el negocio tal como aparece en Google Maps"
                )}
                className="[&_input]:h-11 [&_input]:border-white/10 [&_input]:bg-black/30 [&_input]:text-white [&_input]:placeholder:text-white/45 [&_input]:focus-visible:ring-ts-orange/70"
                onBusinessSelected={(place) => {
                  setSelectedPlace(place);
                  const nextName = String(place.businessName || "").trim();
                  if (nextName) setQ(nextName);
                  const nextState = String(place.stateCode || "")
                    .trim()
                    .toUpperCase();
                  if (nextState) setStateCode(nextState);
                  const nextCountyFips = findCountyFipsFromPlace(place);
                  if (nextCountyFips) setCountyFips(nextCountyFips);
                  void searchClaimableBusinesses({
                    q: nextName || q,
                    stateCode: nextState || stateCode,
                    countyFips: nextCountyFips || countyFips,
                    place,
                  });
                }}
              />
              <p className="text-xs text-white/55">
                {text(
                  "Selecting a Maps result captures place ID, address, website, and phone when Google provides them.",
                  "Al seleccionar un resultado, se guardan el identificador, la dirección, el sitio web y el teléfono que proporcione Google."
                )}
              </p>
            </div>

            {selectedPlace ? (
              <div className="grid gap-2 rounded-lg border border-ts-orange/25 bg-ts-orange/8 p-3 text-sm sm:grid-cols-3">
                <div className="sm:col-span-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-ts-orange">
                    {text("Selected place", "Lugar seleccionado")}
                  </div>
                  <div className="mt-1 font-semibold text-white">
                    {selectedPlace.businessName ||
                      q ||
                      text("Google Maps business", "Negocio en Google Maps")}
                  </div>
                </div>
                <div className="flex items-start gap-2 text-white/70">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ts-orange" />
                  <span>
                    {selectedPlace.address ||
                      [selectedPlace.city, selectedPlace.stateCode].filter(Boolean).join(", ") ||
                      text("Address pending", "Dirección pendiente")}
                  </span>
                </div>
                <div className="flex items-start gap-2 text-white/70">
                  <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-ts-orange" />
                  <span className="truncate">
                    {selectedPlace.website
                      ? selectedPlace.website.replace(/^https?:\/\//, "")
                      : text("Website not returned", "Google no proporcionó el sitio web")}
                  </span>
                </div>
                <div className="flex items-start gap-2 text-white/70">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-ts-orange" />
                  <span>
                    {selectedPlace.phone ||
                      text("Phone not returned", "Google no proporcionó el teléfono")}
                  </span>
                </div>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                {text("Primary county", "Condado principal")}
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
                {text("TradeScout match", "Coincidencia en TradeScout")}
              </Label>
              <div className="flex gap-2">
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={text("Search your business", "Busca tu negocio")}
                  className="h-10 border-white/10 bg-black/30 text-white placeholder:text-white/60 focus-visible:ring-ts-orange/70"
                />
                <Button onClick={runSearch} disabled={searching}>
                  <Search className="h-4 w-4 mr-2" />
                  {searching ? text("Checking…", "Comprobando…") : text("Check", "Comprobar")}
                </Button>
              </div>
              <p className="text-xs text-white/60">
                {text(
                  "Maps place ID, phone, website, and name are checked against claimable TradeScout records.",
                  "El identificador, teléfono, sitio web y nombre de Maps se comparan con los registros reclamables de TradeScout."
                )}
              </p>
            </div>
          </div>

          {items.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-ts-orange">
                {selectedPlace
                  ? text("Maps match found", "Coincidencia de Maps encontrada")
                  : text("Claimable matches", "Coincidencias reclamables")}
              </div>
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
                        {claiming ? text("Claiming…", "Reclamando…") : text("Claim", "Reclamar")}
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" onClick={() => startSigninWithClaim(item.id)}>
                          {text("Sign in", "Iniciar sesión")}
                        </Button>
                        <Button onClick={() => startSignupWithClaim(item.id)}>
                          <ArrowRight className="h-4 w-4 mr-2" />
                          {text("Sign up", "Crear cuenta")}
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
                {items.length > 0
                  ? text("Use the selected match", "Usa la coincidencia seleccionada")
                  : text("No TradeScout match yet", "Aún no hay coincidencia en TradeScout")}
              </div>
              <div className="text-xs text-white/60">
                {selectedPlace
                  ? text(
                      "Create a claimable shell from the Maps listing, then verify ownership.",
                      "Crea un registro reclamable desde Maps y luego verifica la propiedad."
                    )
                  : text(
                      "Select the Google Maps listing first so TradeScout can carry the place ID into the claim.",
                      "Selecciona primero el negocio en Google Maps para incluir su identificador en el reclamo."
                    )}
              </div>
            </div>
            <Button onClick={createAndClaim} disabled={creating || !selectedPlace}>
              {creating
                ? text("Checking…", "Comprobando…")
                : text("Create from Maps", "Crear desde Maps")}
            </Button>
          </div>

          {isAuthenticated && selectedBusinessId ? (
            <div className="text-xs text-white/60">
              {text("Signed in as", "Sesión iniciada como")}{" "}
              {String(user?.email || "").trim() || text("your account", "tu cuenta")}.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
