import { useEffect, useMemo, useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type OwnedBusiness = {
  id: string;
  slug: string;
  name: string;
  roleContext: string;
  status: string;
  profileData?: any;
};

type BusinessDetail = OwnedBusiness & {
  countyIds?: string[];
  profileData?: {
    tagline?: string;
    description?: string;
    category?: string;
    services?: string[];
    website?: string;
    phone?: string;
    email?: string;
    contactPreference?: "call" | "email" | "message";
  };
};

export default function BusinessProfileEditor() {
  const { toast } = useToast();
  const [, params] = useRoute("/business/:slug/edit");
  const [, setLocation] = useLocation();

  const slug = params?.slug;

  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<BusinessDetail | null>(null);

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [phone, setPhone] = useState("");
  const [servicesText, setServicesText] = useState("");

  const services = useMemo(() => {
    return servicesText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);
  }, [servicesText]);

  useEffect(() => {
    const load = async () => {
      if (!slug) return;

      try {
        const listRes = await apiRequest("GET", "/api/businesses");
        const list = (await listRes.json()) as OwnedBusiness[];
        const found = list.find((b) => b.slug === slug);
        if (!found) {
          setBusiness(null);
          return;
        }

        const detailRes = await apiRequest("GET", `/api/businesses/${found.id}`);
        const detail = (await detailRes.json()) as BusinessDetail;
        setBusiness(detail);

        setName(detail.name || "");
        setTagline(detail.profileData?.tagline || "");
        setDescription(detail.profileData?.description || "");
        setWebsite(detail.profileData?.website || "");
        setPhone(detail.profileData?.phone || "");
        setServicesText((detail.profileData?.services || []).join(", "));
      } catch (error: any) {
        console.error("Error loading business:", error);
        toast({
          title: "Could not load business",
          description: error?.message || "Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [slug, toast]);

  const onSave = async () => {
    if (!business) return;

    try {
      await apiRequest("PUT", `/api/businesses/${business.id}`, {
        name,
        profileData: {
          ...(business.profileData || {}),
          tagline,
          description,
          website,
          phone,
          services,
        },
      });

      toast({
        title: "Saved",
        description: "Your business profile updates are live.",
      });

      setLocation(`/business/${business.slug}`);
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="ts-surface px-4 py-6 md:px-10 md:py-8 text-white">Loading editor…</div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center px-4">
        <Card className="bg-navy-800 border-navy-700 w-full max-w-xl">
          <CardHeader>
            <CardTitle className="text-white">Business not found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-300">You may not have access to this business.</p>
            <Link href="/dashboard">
              <Button className="bg-orange-500 hover:bg-orange-600 text-white">Go to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-900 py-8">
      <div className="container mx-auto px-4 max-w-3xl">
        <Card className="bg-navy-800 border-navy-700">
          <CardHeader>
            <CardTitle className="text-white">Edit Business Profile</CardTitle>
            <p className="text-gray-300 text-sm">
              This page edits your public website profile.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-gray-200">Business name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-200">Tagline</Label>
              <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Short one-liner" />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-200">About</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-200">Website</Label>
                <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-200">Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-200">Services (comma-separated)</Label>
              <Input value={servicesText} onChange={(e) => setServicesText(e.target.value)} />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button onClick={onSave} className="bg-orange-500 hover:bg-orange-600 text-white">
                Save & View Public Profile
              </Button>
              <Link href={`/business/${business.slug}`}>
                <Button variant="outline" className="border-navy-500 text-gray-200">Cancel</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
