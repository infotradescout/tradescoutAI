import { useMemo } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type LandingPayload = {
  project: {
    title: string;
    summary: string;
    scopeOfWork: string;
    requirements: string;
    stateCode: string;
    countyFips: string;
    budgetMin?: string | null;
    budgetMax?: string | null;
    bidDueAt?: string | null;
    campaignHeadline?: string | null;
    campaignBody?: string | null;
    heroImageUrl?: string | null;
  };
  documents: Array<{ id: string; fileName: string; fileUrl: string; mimeType?: string | null }>;
  bidsCount: number;
};

export default function CommercialProjectLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, error } = useQuery<LandingPayload>({
    queryKey: ["/api/commercial-directory/landing", slug],
    queryFn: () => apiRequest("GET", `/api/commercial-directory/landing/${slug}`),
    enabled: Boolean(slug),
  });

  const budget = useMemo(() => {
    if (!data?.project) return "";
    const min = data.project.budgetMin ? Number(data.project.budgetMin).toLocaleString() : null;
    const max = data.project.budgetMax ? Number(data.project.budgetMax).toLocaleString() : null;
    if (min && max) return `$${min} - $${max}`;
    if (min) return `From $${min}`;
    if (max) return `Up to $${max}`;
    return "Budget on request";
  }, [data]);

  if (isLoading) return <div className="max-w-5xl mx-auto p-6">Loading campaign page...</div>;
  if (error || !data) return <div className="max-w-5xl mx-auto p-6">Campaign page not found.</div>;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">
            {data.project.campaignHeadline || data.project.title}
          </CardTitle>
          <p className="text-muted-foreground">
            {data.project.stateCode}-{data.project.countyFips} | {budget}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.project.heroImageUrl && (
            <img
              src={data.project.heroImageUrl}
              alt={data.project.title}
              className="w-full max-h-[320px] object-cover rounded"
            />
          )}
          <p>{data.project.campaignBody || data.project.summary}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/commercial-directory">Verified Contractor Bidding Portal</Link>
            </Button>
            <Button asChild variant="outline">
              <a href="/create-account">Create Account</a>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Live bids submitted: {data.bidsCount}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scope of Work</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap">{data.project.scopeOfWork}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap">{data.project.requirements}</p>
        </CardContent>
      </Card>

      {!!data.documents.length && (
        <Card>
          <CardHeader>
            <CardTitle>Project Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.documents.map((doc) => (
                <li key={doc.id}>
                  <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="underline">
                    {doc.fileName}
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
