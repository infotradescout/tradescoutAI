import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Page, Section } from "@/components/layout/PagePrimitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { SEOHelmet } from "@/components/SEOHelmet";
import { ShareButton } from "@/components/ShareButton";
import {
  buildProfilePortfolioItemSlug,
  buildProfilePortfolioShareSearch,
  createProfilePortfolioItemShareMetadata,
} from "@shared/profilePortfolioShare";
import {
  Award,
  Briefcase,
  Calendar,
  Car,
  CheckCircle,
  Clock,
  DollarSign,
  GraduationCap,
  MapPin,
  MessageSquare,
  Shield,
  User,
  Wrench,
  Zap,
} from "lucide-react";

// ── helpers ───────────────────────────────────────────────────────────────────

const DAY_LABELS: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

function AvailabilityGrid({ hours }: { hours: Record<string, { start: string; end: string }> }) {
  const days = Object.keys(DAY_LABELS);
  const activeDays = days.filter((d) => hours[d]);
  if (!activeDays.length) return <p className="text-white/40 text-sm">Not specified</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {activeDays.map((day) => (
        <div
          key={day}
          className="flex flex-col items-center bg-white/5 border border-white/10 rounded-lg px-3 py-2 min-w-[60px]"
        >
          <span className="text-xs font-medium text-white/70">{DAY_LABELS[day]}</span>
          <span className="text-[10px] text-white/40 mt-0.5">
            {hours[day].start}–{hours[day].end}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function HelperPublicProfile() {
  const { id } = useParams<{ id: string }>();

  const {
    data: profile,
    isLoading,
    isError,
  } = useQuery<any>({
    queryKey: [`/api/workers/${id}/public`],
    queryFn: () => apiRequest("GET", `/api/workers/${id}/public`).then((r) => r.json()),
    enabled: Boolean(id),
  });

  const portfolioShareMeta = useMemo(() => {
    if (!profile?.id || !id || typeof window === "undefined") return null;
    const profileName = `${profile.firstName || ""} ${profile.lastName || ""}`.trim();
    const origin = window.location.origin;
    return createProfilePortfolioItemShareMetadata({
      profileName,
      profileUrl: `${origin}/helpers/${encodeURIComponent(id)}`,
      assetOrigin: origin,
      portfolioItems: profile.portfolioItems,
      itemSlug: new URLSearchParams(window.location.search).get("portfolio"),
    });
  }, [id, profile]);

  useEffect(() => {
    if (!portfolioShareMeta) return;
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(`portfolio-${portfolioShareMeta.itemSlug}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [portfolioShareMeta]);

  if (isLoading) {
    return (
      <Page className="max-w-4xl">
        <Section title="Loading…" subtitle="">
          <div className="animate-pulse space-y-4">
            <div className="h-24 bg-white/5 rounded-xl" />
            <div className="h-40 bg-white/5 rounded-xl" />
          </div>
        </Section>
      </Page>
    );
  }

  if (isError || !profile?.id) {
    return (
      <Page className="max-w-4xl">
        <Section
          title="Helper not found"
          subtitle="This profile may have been removed or is unavailable."
        >
          <Button asChild variant="outline" className="border-white/20 text-white/70">
            <Link href="/worker-marketplace">Browse Helpers</Link>
          </Button>
        </Section>
      </Page>
    );
  }

  const fullName = `${profile.firstName} ${profile.lastName}`;
  const isVerified = profile.verificationStatus === "approved";
  const profileCanonical = `${window.location.origin}/helpers/${encodeURIComponent(id)}`;
  const profileDescription =
    String(profile.bio || "").trim() ||
    `View ${fullName}'s skills, experience, availability, and portfolio. Contact stays protected through TradeScout Direct Connect.`;
  const structuredData = portfolioShareMeta
    ? {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Person",
            name: fullName,
            description: profileDescription,
            url: profileCanonical,
            image: profile.profileImageUrl || undefined,
          },
          {
            "@type": "CreativeWork",
            "@id": `${portfolioShareMeta.canonical}#portfolio-item`,
            name: portfolioShareMeta.itemTitle,
            description: portfolioShareMeta.description,
            image: [portfolioShareMeta.imageUrl],
            url: portfolioShareMeta.canonical,
            creator: { "@type": "Person", name: fullName },
          },
        ],
      }
    : {
        "@context": "https://schema.org",
        "@type": "Person",
        name: fullName,
        description: profileDescription,
        url: profileCanonical,
        image: profile.profileImageUrl || undefined,
      };

  return (
    <Page className="max-w-4xl">
      <SEOHelmet
        title={portfolioShareMeta?.title || `${fullName} | TradeScout`}
        description={portfolioShareMeta?.description || profileDescription}
        canonical={portfolioShareMeta?.canonical || profileCanonical}
        ogType={portfolioShareMeta ? "article" : "profile"}
        ogImage={portfolioShareMeta?.imageUrl || profile.profileImageUrl || undefined}
        structuredData={structuredData}
        preserveCanonicalQuery={Boolean(portfolioShareMeta)}
      />
      {/* Hero */}
      <div className="flex flex-col sm:flex-row items-start gap-6 mb-8">
        {/* Avatar */}
        <div className="shrink-0">
          {profile.profileImageUrl ? (
            <img
              src={profile.profileImageUrl}
              alt={fullName}
              className="w-24 h-24 rounded-2xl object-cover border border-white/10"
            />
          ) : (
            <div className="w-24 h-24 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10">
              <User className="w-10 h-10 text-white/30" />
            </div>
          )}
        </div>

        {/* Name + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white" data-testid="helper-profile-name">
              {fullName}
            </h1>
            {isVerified && (
              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                <CheckCircle className="w-3 h-3 mr-1" /> Verified
              </Badge>
            )}
            {profile.isBackgroundChecked && (
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                <Shield className="w-3 h-3 mr-1" /> Background Checked
              </Badge>
            )}
            {profile.isAvailable ? (
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 inline-block" />
                Available
              </Badge>
            ) : (
              <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30">
                Not available
              </Badge>
            )}
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-white/50 mb-3">
            <div className="flex items-center gap-1">
              <Briefcase className="w-4 h-4" />
              {profile.totalJobsCompleted ?? 0} jobs completed
            </div>
            {profile.hourlyRate && (
              <div className="flex items-center gap-1">
                <DollarSign className="w-4 h-4" />${Number(profile.hourlyRate)}/hr
              </div>
            )}
            {profile.maxTravelDistance && (
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                Up to {profile.maxTravelDistance} mi
              </div>
            )}
          </div>

          {/* Bio */}
          {profile.bio && <p className="text-white/70 text-sm leading-relaxed">{profile.bio}</p>}
        </div>

        {/* CTA */}
        <div className="shrink-0 flex flex-col gap-2 sm:items-end">
          <Button
            asChild
            className="bg-ts-orange hover:bg-ts-orange-dark text-white"
            data-testid="helper-contact-cta"
          >
            <Link href="/direct-connect">
              <MessageSquare className="w-4 h-4 mr-2" /> Request via Direct Connect
            </Link>
          </Button>
        </div>
      </div>

      <Separator className="bg-white/10 mb-8" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* Skills */}
          {Array.isArray(profile.skills) && profile.skills.length > 0 && (
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white/70 flex items-center gap-2">
                  <Wrench className="w-4 h-4" /> Skills
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2" data-testid="helper-skills-list">
                  {profile.skills.map((skill: string) => (
                    <Badge
                      key={skill}
                      variant="outline"
                      className="border-white/20 text-white/70 text-xs"
                    >
                      {skill}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transportation */}
          {profile.transportationMethod && (
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white/70 flex items-center gap-2">
                  <Car className="w-4 h-4" /> Transportation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-white/70 capitalize">
                  {profile.transportationMethod.replace(/_/g, " ")}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Availability */}
          {profile.availableHours && Object.keys(profile.availableHours).length > 0 && (
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white/70 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Availability
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AvailabilityGrid hours={profile.availableHours} />
              </CardContent>
            </Card>
          )}

          {/* Certifications */}
          {Array.isArray(profile.certifications) && profile.certifications.length > 0 && (
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white/70 flex items-center gap-2">
                  <Award className="w-4 h-4" /> Certifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {profile.certifications.map((cert: any, i: number) => (
                  <div key={i}>
                    <p className="text-sm font-medium text-white">{cert.name}</p>
                    <p className="text-xs text-white/50">{cert.issuer}</p>
                    {cert.issueDate && <p className="text-xs text-white/30">{cert.issueDate}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Work experience */}
          {Array.isArray(profile.workExperience) && profile.workExperience.length > 0 && (
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white/70 flex items-center gap-2">
                  <Briefcase className="w-4 h-4" /> Work Experience
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {profile.workExperience.map((exp: any, i: number) => (
                  <div key={i}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-white text-sm">{exp.jobTitle}</p>
                        <p className="text-xs text-white/50">{exp.company}</p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-white/30 shrink-0">
                        <Calendar className="w-3 h-3" />
                        {exp.startDate} – {exp.isCurrentJob ? "Present" : (exp.endDate ?? "")}
                      </div>
                    </div>
                    {exp.description && (
                      <p className="text-xs text-white/60 mt-1 leading-relaxed">
                        {exp.description}
                      </p>
                    )}
                    {exp.fromPlatform && (
                      <Badge className="mt-1 bg-ts-orange/10 text-ts-orange border-ts-orange/20 text-[10px]">
                        <Zap className="w-2.5 h-2.5 mr-1" /> Via TradeScout
                      </Badge>
                    )}
                    {i < profile.workExperience.length - 1 && (
                      <Separator className="mt-3 bg-white/10" />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Education */}
          {Array.isArray(profile.education) && profile.education.length > 0 && (
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white/70 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4" /> Education
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {profile.education.map((edu: any, i: number) => (
                  <div key={i}>
                    <p className="font-medium text-white text-sm">{edu.degree}</p>
                    <p className="text-xs text-white/50">{edu.school}</p>
                    {edu.fieldOfStudy && (
                      <p className="text-xs text-white/40">{edu.fieldOfStudy}</p>
                    )}
                    {edu.graduationYear && (
                      <p className="text-xs text-white/30">{edu.graduationYear}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Portfolio */}
          {Array.isArray(profile.portfolioItems) && profile.portfolioItems.length > 0 && (
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white/70 flex items-center gap-2">
                  <Award className="w-4 h-4" /> Portfolio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                  data-testid="helper-portfolio-grid"
                >
                  {profile.portfolioItems.map((item: any, i: number) => {
                    const itemSlug = buildProfilePortfolioItemSlug(item);
                    const shareSearch = buildProfilePortfolioShareSearch(item);
                    const isSharedItem = itemSlug === portfolioShareMeta?.itemSlug;

                    return (
                      <div
                        key={itemSlug || i}
                        id={itemSlug ? `portfolio-${itemSlug}` : undefined}
                        className={`rounded-xl border overflow-hidden bg-white/3 transition-shadow ${
                          isSharedItem
                            ? "border-ts-orange ring-2 ring-ts-orange/35 shadow-[0_0_32px_rgba(249,115,22,0.18)]"
                            : "border-white/10"
                        }`}
                      >
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="w-full h-32 object-cover"
                          />
                        )}
                        <div className="p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium text-white text-sm">{item.title}</p>
                              {isSharedItem ? (
                                <Badge className="mt-1 bg-ts-orange/15 text-ts-orange border-ts-orange/25 text-[10px]">
                                  Shared portfolio item
                                </Badge>
                              ) : null}
                            </div>
                            {itemSlug && shareSearch ? (
                              <ShareButton
                                destination={`/helpers/${encodeURIComponent(id)}${shareSearch}`}
                                title={item.title}
                                text={`${item.title} by ${fullName}`}
                                size="sm"
                                label="Share"
                                className="shrink-0 border-white/15 text-white/70 hover:text-white"
                              />
                            ) : null}
                          </div>
                          <p className="text-xs text-white/50 mt-0.5 line-clamp-2">
                            {item.description}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {item.skills?.slice(0, 3).map((s: string) => (
                              <Badge
                                key={s}
                                variant="outline"
                                className="border-white/10 text-white/50 text-[10px]"
                              >
                                {s}
                              </Badge>
                            ))}
                          </div>
                          {item.fromPlatform && (
                            <Badge className="mt-2 bg-ts-orange/10 text-ts-orange border-ts-orange/20 text-[10px]">
                              <Zap className="w-2.5 h-2.5 mr-1" /> Via TradeScout
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {!profile.workExperience?.length &&
            !profile.education?.length &&
            !profile.portfolioItems?.length && (
              <Card className="bg-white/5 border-white/10">
                <CardContent className="py-10 text-center">
                  <User className="w-10 h-10 text-white/20 mx-auto mb-3" />
                  <p className="text-white/40 text-sm">
                    This helper hasn't added work history or portfolio items yet.
                  </p>
                </CardContent>
              </Card>
            )}
        </div>
      </div>
    </Page>
  );
}
