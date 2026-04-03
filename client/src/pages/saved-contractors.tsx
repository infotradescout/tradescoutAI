import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, ShieldCheck, Trash2 } from "lucide-react";
import { Page, Section } from "@/components/layout/PagePrimitives";

type SavedContractor = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  category?: string | null;
  location?: string | null;
  verified: boolean;
};

const SavedContractorsPage = () => {
  const { data, isLoading, isError } = useQuery<SavedContractor[]>({
    queryKey: ["/api/saved-contractors"],
    queryFn: () => apiRequest("GET", "/api/saved-contractors"),
  });

  const unsaveMutation = useMutation({
    mutationFn: (contractorId: string) =>
      apiRequest("DELETE", `/api/saved-contractors/${encodeURIComponent(contractorId)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-contractors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
  });

  if (isLoading) {
    return (
      <Page>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-ts-orange animate-spin" />
        </div>
      </Page>
    );
  }

  if (isError) {
    return (
      <Page>
        <div className="flex items-center justify-center py-24">
          <p className="text-white/70 text-sm">Failed to load saved contractors.</p>
        </div>
      </Page>
    );
  }

  const saved = data ?? [];

  return (
    <Page className="max-w-5xl">
      <Section
        title="Saved Contractors"
        subtitle="Pros you've bookmarked while browsing Exchange and local listings."
        actions={
          saved.length > 0 ? (
            <Badge variant="secondary" className="bg-white/5 border-white/15 text-xs">
              {saved.length} saved
            </Badge>
          ) : undefined
        }
      >
        {saved.length === 0 ? (
          <Card className="bg-tsCard/95 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">No saved contractors yet</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-white/70 text-sm mb-3">
                Use the Save or Bookmark actions on contractor cards to keep track of pros you want
                to compare later.
              </p>
              <p className="text-white/60 text-xs">
                Once you&apos;ve saved a few, they&apos;ll show up here for quick access and
                side-by-side review.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {saved.map((c) => (
              <Card key={c.id} className="bg-tsCard/95 border-white/10 flex flex-col">
                <CardHeader className="flex flex-row items-center gap-3 pb-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={c.avatarUrl || undefined} alt={c.name} />
                    <AvatarFallback className="bg-white/5 text-xs">
                      {c.name
                        .split(" ")
                        .map((p) => p[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base text-white truncate flex items-center gap-2">
                      <span className="truncate">{c.name}</span>
                      {c.verified && (
                        <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1 text-xs text-white/60">
                      {c.category && <span className="truncate">{c.category}</span>}
                      {c.location && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3" />
                          {c.location}
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-white/70 hover:text-red-400 hover:bg-red-950/40"
                    onClick={() => unsaveMutation.mutate(c.id)}
                    disabled={unsaveMutation.isPending}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Remove
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </Page>
  );
};

export default SavedContractorsPage;
