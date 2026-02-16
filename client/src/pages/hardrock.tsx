import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  contactName: z.string().min(2, "Contact name is required"),
  email: z.string().email("Valid email required"),
  phone: z
    .string()
    .min(1, "Phone number is required")
    .refine((value) => value.replace(/\D/g, "").length >= 10, "Please enter a valid phone number"),
  website: z.string().optional(),
  primaryState: z.string().min(2, "State is required"),
  primaryCounty: z.string().min(2, "County is required"),
  yearsInBusiness: z.coerce.number().int().min(0).optional().default(0),
  licenseNumber: z.string().min(1, "License number is required"),
  insuranceProvider: z.string().min(1, "Insurance provider is required"),
  primaryTrade: z.string().min(1, "Primary trade is required"),
  specialties: z.string().min(2, "Add at least one specialty (comma-separated)"),
  about: z.string().min(20, "Tell us a bit more (20+ chars)"),
  preferredContact: z.enum(["phone", "email", "both"]).default("both"),
  agreeToTerms: z.boolean().refine((v) => v === true, "Required"),
  agreeToVerification: z.boolean().refine((v) => v === true, "Required"),
  // Honeypot
  companyFax: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function HardrockLanding() {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: "",
      contactName: "",
      email: "",
      phone: "",
      website: "",
      primaryState: "",
      primaryCounty: "",
      yearsInBusiness: 0,
      licenseNumber: "",
      insuranceProvider: "",
      primaryTrade: "",
      specialties: "",
      about: "",
      preferredContact: "both",
      agreeToTerms: false,
      agreeToVerification: false,
      companyFax: "",
    },
  });

  const errorSummary = useMemo(() => {
    const errs = form.formState.errors;
    const keys = Object.keys(errs);
    if (keys.length === 0) return null;
    return keys
      .slice(0, 3)
      .map((k) => {
        const message = errs[k as keyof typeof errs]?.message;
        return typeof message === "string" ? message : null;
      })
      .filter(Boolean)
      .join(" • ");
  }, [form.formState.errors]);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setSubmittedId(null);
    try {
      const filesInput = document.getElementById("hardrock-files") as HTMLInputElement | null;
      const fd = new FormData();

      Object.entries(values).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        fd.append(k, String(v));
      });

      if (filesInput?.files && filesInput.files.length > 0) {
        Array.from(filesInput.files).forEach((file) => fd.append("files", file));
      }

      const res = await fetch("/api/hardrock/apply", {
        method: "POST",
        body: fd,
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const message = payload?.message || "Submission failed. Please try again.";
        throw new Error(message);
      }

      setSubmittedId(payload?.applicationId || null);
      toast({
        title: "Submitted",
        description: "We received your info. We’ll reach out soon.",
      });
      form.reset();
      if (filesInput) filesInput.value = "";
    } catch (err: unknown) {
      toast({
        title: "Couldn’t submit",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen  text-tsTextMain px-4 py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Hardrock commercial jobs</h1>
          <p className="text-sm text-tsTextMuted max-w-2xl">
            No account required. Send us your info and we’ll contact you about upcoming commercial
            work. You can create a TradeScout account anytime to manage opportunities faster.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/pre-scout-setup?mode=create">
              <Button className="bg-tsAccent hover:bg-tsAccent/90 text-black font-semibold">
                Create a TradeScout account
              </Button>
            </Link>
            <Link href="/pre-scout-setup?mode=signin">
              <Button variant="outline">Sign in</Button>
            </Link>
          </div>
          <p className="text-xs text-tsTextMuted">
            Contact: <span className="font-medium text-tsTextMain">info.tradescout@gmail.com</span>
          </p>
        </div>

        <Card className="bg-tsCard border border-tsBorder">
          <CardHeader>
            <CardTitle className="text-lg">Hard Rock: Pensacola News Journal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-hidden rounded-xl border border-tsBorder bg-black/20">
              {/* Place the screenshot at client/public/hardrock-pnj.png */}
              <img
                src="/hardrock-pnj.png"
                alt="Pensacola News Journal post about Pensacola Hard Rock project looking for local contractors"
                className="w-full h-auto block"
                loading="lazy"
              />
            </div>
            <p className="text-xs text-tsTextMuted">
              Screenshot: Pensacola News Journal coverage about the Hard Rock project seeking local
              contractors (Jan. 31, 2026).
            </p>
          </CardContent>
        </Card>

        <Card className="bg-tsCard border border-tsBorder">
          <CardHeader>
            <CardTitle className="text-lg">
              Pensacola: Hard Rock project — last call for local contractors
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-tsTextMuted">
              If you’re a subcontractor/supplier in{" "}
              <span className="text-tsTextMain">Escambia</span> or{" "}
              <span className="text-tsTextMain">Santa Rosa</span> County, the last in-person
              information session is{" "}
              <span className="text-tsTextMain font-medium">
                today (Feb. 2, 2026) 8:00–10:00 a.m.
              </span>
              .
            </p>
            <p className="text-tsTextMuted">
              Location: <span className="text-tsTextMain">Maritime Place</span>, first floor,{" "}
              <span className="text-tsTextMain">350 W. Cedar St., Pensacola</span>.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                className="bg-tsAccent hover:bg-tsAccent/90 text-black font-semibold"
                onClick={() => {
                  const el = document.getElementById("apply-form");
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Submit your info here
              </Button>
              <Link href="/pre-scout-setup?mode=create">
                <Button variant="outline">Create account (optional)</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-tsCard border border-tsBorder">
          <CardHeader id="apply-form">
            <CardTitle className="text-xl">Commercial tradesman sign-up</CardTitle>
          </CardHeader>
          <CardContent>
            {errorSummary && (
              <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {errorSummary}
              </div>
            )}

            {submittedId && (
              <div className="mb-4 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-foreground">
                Submitted. Reference ID: <span className="font-mono">{submittedId}</span>
              </div>
            )}

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Honeypot */}
              <div className="hidden" aria-hidden="true">
                <Label htmlFor="companyFax">Company Fax</Label>
                <Input
                  id="companyFax"
                  {...form.register("companyFax")}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="companyName">Company name</Label>
                  <Input id="companyName" {...form.register("companyName")} />
                  {form.formState.errors.companyName && (
                    <p className="text-xs text-destructive mt-1">
                      {form.formState.errors.companyName.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="contactName">Contact name</Label>
                  <Input id="contactName" {...form.register("contactName")} />
                  {form.formState.errors.contactName && (
                    <p className="text-xs text-destructive mt-1">
                      {form.formState.errors.contactName.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
                  {form.formState.errors.email && (
                    <p className="text-xs text-destructive mt-1">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" autoComplete="tel" {...form.register("phone")} />
                  {form.formState.errors.phone && (
                    <p className="text-xs text-destructive mt-1">
                      {form.formState.errors.phone.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="website">Website (optional)</Label>
                  <Input id="website" {...form.register("website")} placeholder="https://…" />
                </div>
                <div>
                  <Label htmlFor="yearsInBusiness">Years in business</Label>
                  <Input
                    id="yearsInBusiness"
                    type="number"
                    min={0}
                    {...form.register("yearsInBusiness")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="primaryState">Primary state</Label>
                  <Input
                    id="primaryState"
                    {...form.register("primaryState")}
                    placeholder="e.g. TX"
                  />
                  {form.formState.errors.primaryState && (
                    <p className="text-xs text-destructive mt-1">
                      {form.formState.errors.primaryState.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="primaryCounty">Primary county</Label>
                  <Input
                    id="primaryCounty"
                    {...form.register("primaryCounty")}
                    placeholder="e.g. Travis"
                  />
                  {form.formState.errors.primaryCounty && (
                    <p className="text-xs text-destructive mt-1">
                      {form.formState.errors.primaryCounty.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="licenseNumber">License number</Label>
                  <Input id="licenseNumber" {...form.register("licenseNumber")} />
                  {form.formState.errors.licenseNumber && (
                    <p className="text-xs text-destructive mt-1">
                      {form.formState.errors.licenseNumber.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="insuranceProvider">Insurance provider</Label>
                  <Input id="insuranceProvider" {...form.register("insuranceProvider")} />
                  {form.formState.errors.insuranceProvider && (
                    <p className="text-xs text-destructive mt-1">
                      {form.formState.errors.insuranceProvider.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="primaryTrade">Primary trade</Label>
                  <Input
                    id="primaryTrade"
                    {...form.register("primaryTrade")}
                    placeholder="e.g. Electrical"
                  />
                  {form.formState.errors.primaryTrade && (
                    <p className="text-xs text-destructive mt-1">
                      {form.formState.errors.primaryTrade.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="preferredContact">Preferred contact</Label>
                  <select
                    id="preferredContact"
                    className="mt-1 w-full h-10 rounded-md border border-tsBorder bg-tsBg px-3 text-sm"
                    {...form.register("preferredContact")}
                  >
                    <option value="both">Phone + Email</option>
                    <option value="phone">Phone</option>
                    <option value="email">Email</option>
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="specialties">Specialties (comma-separated)</Label>
                <Input
                  id="specialties"
                  {...form.register("specialties")}
                  placeholder="e.g. tenant improvements, framing, HVAC…"
                />
                {form.formState.errors.specialties && (
                  <p className="text-xs text-destructive mt-1">
                    {form.formState.errors.specialties.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="about">Tell us about your commercial experience</Label>
                <textarea
                  id="about"
                  rows={4}
                  className="mt-1 w-full rounded-md border border-tsBorder bg-tsBg px-3 py-2 text-sm text-tsTextMain placeholder:text-tsTextMuted"
                  {...form.register("about")}
                  placeholder="Project types, crew size, availability, service area, etc."
                />
                {form.formState.errors.about && (
                  <p className="text-xs text-destructive mt-1">
                    {form.formState.errors.about.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="hardrock-files">Upload docs (optional)</Label>
                <Input
                  id="hardrock-files"
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                />
                <p className="text-xs text-tsTextMuted mt-1">
                  License/insurance PDFs or photos. Max 5 files.
                </p>
              </div>

              <div className="space-y-2">
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" {...form.register("agreeToTerms")} />
                  <span>
                    I agree to be contacted about commercial jobs and acknowledge TradeScout’s
                    Terms.
                  </span>
                </label>
                {form.formState.errors.agreeToTerms && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.agreeToTerms.message}
                  </p>
                )}

                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    {...form.register("agreeToVerification")}
                  />
                  <span>
                    I confirm the information provided is accurate and understand verification may
                    be requested.
                  </span>
                </label>
                {form.formState.errors.agreeToVerification && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.agreeToVerification.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-tsAccent hover:bg-tsAccent/90 text-black font-semibold"
              >
                {submitting ? "Submitting…" : "Send my info"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
