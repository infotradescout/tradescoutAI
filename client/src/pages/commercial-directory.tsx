import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type BoardProject = {
  project: {
    id: string;
    title: string;
    slug: string;
    summary: string;
    countyFips: string;
    stateCode: string;
    budgetMin?: string | null;
    budgetMax?: string | null;
    bidDueAt?: string | null;
  };
  bidsCount: number;
  docsCount: number;
};

export default function CommercialDirectoryPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [timelineDays, setTimelineDays] = useState("");
  const [proposal, setProposal] = useState("");

  const { data, isLoading, error } = useQuery<BoardProject[]>({
    queryKey: ["/api/commercial-directory/projects"],
    queryFn: () => apiRequest("GET", "/api/commercial-directory/projects"),
  });

  const bidMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProjectId) throw new Error("Select a project first");
      return apiRequest("POST", `/api/commercial-directory/projects/${selectedProjectId}/bids`, {
        amount: Number(amount),
        timelineDays: timelineDays ? Number(timelineDays) : undefined,
        proposal,
      });
    },
    onSuccess: () => {
      toast({ title: "Bid submitted", description: "Your bid is now on the project board." });
      setAmount("");
      setTimelineDays("");
      setProposal("");
      queryClient.invalidateQueries({ queryKey: ["/api/commercial-directory/projects"] });
    },
    onError: (err: any) => {
      toast({
        title: "Bid failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Commercial Directory Board</CardTitle>
          <CardDescription>
            Open commercial projects available for verified contractors to bid.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p>Loading board...</p>}
          {error && (
            <p className="text-sm text-red-400">
              {(error as Error)?.message || "Failed to load board."}
            </p>
          )}
          {!isLoading && !data?.length && <p>No open projects right now.</p>}

          {(data || []).map((row) => (
            <div key={row.project.id} className="border rounded p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{row.project.title}</div>
                <Button
                  variant={selectedProjectId === row.project.id ? "default" : "outline"}
                  onClick={() => setSelectedProjectId(row.project.id)}
                >
                  {selectedProjectId === row.project.id ? "Selected" : "Bid on this"}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{row.project.summary}</p>
              <div className="text-xs text-muted-foreground">
                {row.project.stateCode}-{row.project.countyFips} | bids: {row.bidsCount} | docs:{" "}
                {row.docsCount}
              </div>
              <div className="text-xs">
                Campaign page:{" "}
                <a href={`/commercial/p/${row.project.slug}`} className="underline">
                  {`/commercial/p/${row.project.slug}`}
                </a>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Submit Bid</CardTitle>
          <CardDescription>
            Selected project: {selectedProjectId ? selectedProjectId : "none"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Bid Amount</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Timeline (days)</Label>
            <Input
              type="number"
              value={timelineDays}
              onChange={(e) => setTimelineDays(e.target.value)}
            />
          </div>
          <div>
            <Label>Proposal</Label>
            <Textarea value={proposal} onChange={(e) => setProposal(e.target.value)} rows={6} />
          </div>
          <Button
            onClick={() => bidMutation.mutate()}
            disabled={
              bidMutation.isPending ||
              !selectedProjectId ||
              !amount ||
              Number(amount) <= 0 ||
              proposal.trim().length < 20
            }
          >
            {bidMutation.isPending ? "Submitting..." : "Submit Bid"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
