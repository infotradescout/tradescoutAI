import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useScopeGovernorGate } from "@/hooks/useScopeGovernorGate";
import { CheckCircle2, XCircle, Clock, Sparkles, AlertTriangle, TrendingUp, Users, Zap } from "lucide-react";

type ToolBlueprint = {
  id: string;
  name: string;
  description: string;
  status: 'proposed' | 'approved' | 'rejected' | 'archived' | 'implemented' | 'merged';
  priority: 'critical' | 'high' | 'medium' | 'low';
  problemStatement: string;
  estimatedImpact: {
    timesSaved: number;
    outcomeImprovement: string;
    regretPrevention: string;
  };
  frequency: number;
  affectedUsers: number;
  primitivesUsed: string[];
  exampleConversations: Array<{
    userId: string;
    context: string;
    message: string;
    workaround: string;
  }>;
  riskLevel: 'low' | 'medium' | 'high';
  reviewNotes?: string;
};

export default function ToolDiscoveryAdmin() {
  const [blueprints, setBlueprints] = useState<ToolBlueprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBlueprint, setSelectedBlueprint] = useState<ToolBlueprint | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const { toast } = useToast();
  const scopeGate = useScopeGovernorGate();
  const featureCreationBlocked = scopeGate.blocked;

  useEffect(() => {
    fetchBlueprints();
  }, []);

  const fetchBlueprints = async () => {
    try {
      const res = await fetch("/api/admin/tool-blueprints");
      if (res.ok) {
        const data = await res.json();
        setBlueprints(data.blueprints || []);
      }
    } catch (error) {
      console.error("Failed to fetch blueprints:", error);
    } finally {
      setLoading(false);
    }
  };

  const approveBlueprint = async (blueprintId: string) => {
    if (featureCreationBlocked) {
      toast({
        title: "Scope is temporarily frozen",
        description: "Fixes and safety work are always allowed. Resolve the listed issues to unfreeze.",
      });
      return;
    }

    try {
      const res = await fetch(`/api/admin/tool-blueprints/${blueprintId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: reviewNotes }),
      });

      if (res.ok) {
        toast({ title: "Blueprint Approved", description: "Tool blueprint approved for implementation" });
        fetchBlueprints();
        setSelectedBlueprint(null);
        setReviewNotes("");
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to approve blueprint", variant: "destructive" });
    }
  };

  const rejectBlueprint = async (blueprintId: string) => {
    try {
      const res = await fetch(`/api/admin/tool-blueprints/${blueprintId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reviewNotes }),
      });

      if (res.ok) {
        toast({ title: "Blueprint Rejected", description: "Tool blueprint rejected" });
        fetchBlueprints();
        setSelectedBlueprint(null);
        setReviewNotes("");
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to reject blueprint", variant: "destructive" });
    }
  };

  const proposedBlueprints = blueprints.filter(b => b.status === "proposed");
  const approvedBlueprints = blueprints.filter(b => b.status === "approved");
  const rejectedBlueprints = blueprints.filter(b => b.status === "rejected");

  if (loading) {
    return (
      <div className="h-full bg-background p-6 flex items-center justify-center">
        <div className="text-muted-foreground">Loading tool discoveries...</div>
      </div>
    );
  }

  return (
    <div className="h-full bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-primary" />
              Tool Discovery Dashboard
            </h1>
            <p className="text-muted-foreground mt-2">
              Scout learns from real user friction and proposes new capabilities
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-foreground">{proposedBlueprints.length}</div>
            <div className="text-sm text-muted-foreground">Pending Review</div>
          </div>
        </div>

        {scopeGate.enforced && featureCreationBlocked && (
          <Card className="border-amber-200 bg-amber-50 text-amber-900">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Scope is temporarily frozen due to unresolved issues.</p>
                  <p className="text-sm">Fixes and safety work are always allowed.</p>
                </div>
              </div>
              {scopeGate.reasons.length > 0 && (
                <ul className="text-sm list-disc pl-6 space-y-1">
                  {scopeGate.reasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Proposed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-foreground">{proposedBlueprints.length}</div>
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-foreground">{approvedBlueprints.length}</div>
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Patterns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-foreground">
                  {blueprints.reduce((sum, b) => sum + b.frequency, 0)}
                </div>
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Affected Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-foreground">
                  {new Set(blueprints.flatMap(b => b.exampleConversations.map((c: any) => c.userId))).size}
                </div>
                <Users className="w-5 h-5 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="proposed" className="w-full">
          <TabsList className="bg-muted border border-border">
            <TabsTrigger value="proposed" className="data-[state=active]:bg-background">
              Proposed ({proposedBlueprints.length})
            </TabsTrigger>
            <TabsTrigger value="approved" className="data-[state=active]:bg-background">
              Approved ({approvedBlueprints.length})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="data-[state=active]:bg-background">
              Rejected ({rejectedBlueprints.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="proposed" className="space-y-4 mt-6">
            {proposedBlueprints.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="p-12 text-center">
                  <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No tool blueprints pending review</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Scout will propose new tools when patterns emerge from real usage
                  </p>
                </CardContent>
              </Card>
            ) : (
              proposedBlueprints.map(blueprint => (
                <BlueprintCard
                  key={blueprint.id}
                  blueprint={blueprint}
                  onSelect={setSelectedBlueprint}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="approved" className="space-y-4 mt-6">
            {approvedBlueprints.map(blueprint => (
              <BlueprintCard key={blueprint.id} blueprint={blueprint} />
            ))}
          </TabsContent>

          <TabsContent value="rejected" className="space-y-4 mt-6">
            {rejectedBlueprints.map(blueprint => (
              <BlueprintCard key={blueprint.id} blueprint={blueprint} />
            ))}
          </TabsContent>
        </Tabs>

        {/* Review Modal */}
        {selectedBlueprint && (
          <div className="fixed inset-0 bg-background/80 flex items-center justify-center p-6 z-50">
            <Card className="bg-card border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="text-foreground">Review: {selectedBlueprint.name}</CardTitle>
                <CardDescription>Decide whether to implement this tool</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Problem Statement</h3>
                  <p className="text-foreground">{selectedBlueprint.problemStatement}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Impact</h3>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>• {selectedBlueprint.estimatedImpact.timesSaved} saves per month</p>
                    <p>• {selectedBlueprint.estimatedImpact.outcomeImprovement}</p>
                    <p>• {selectedBlueprint.estimatedImpact.regretPrevention}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Example Conversations</h3>
                  <div className="space-y-2">
                    {selectedBlueprint.exampleConversations.slice(0, 3).map((ex, i) => (
                      <div key={i} className="bg-muted p-3 rounded text-sm">
                        <p className="text-foreground">{ex.message}</p>
                        <p className="text-muted-foreground mt-1">Workaround: {ex.workaround}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Review Notes
                  </label>
                  <Textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add notes about this decision..."
                    className="bg-muted border-input text-foreground"
                    rows={4}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => approveBlueprint(selectedBlueprint.id)}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    disabled={featureCreationBlocked}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Approve for Implementation
                  </Button>
                  <Button
                    onClick={() => rejectBlueprint(selectedBlueprint.id)}
                    variant="outline"
                    className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => {
                      setSelectedBlueprint(null);
                      setReviewNotes("");
                    }}
                    variant="ghost"
                    className="text-muted-foreground"
                  >
                    Cancel
                  </Button>
                  {featureCreationBlocked && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Scope is frozen while impact/risk issues are open. Fixes and safety work stay unblocked.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function BlueprintCard({
  blueprint,
  onSelect,
}: {
  blueprint: ToolBlueprint;
  onSelect?: (blueprint: ToolBlueprint) => void;
}) {
  const riskColors = {
    low: "text-green-600 bg-green-500/10",
    medium: "text-yellow-600 bg-yellow-500/10",
    high: "text-destructive bg-destructive/10",
  };

  const statusColors = {
    proposed: "text-yellow-600 bg-yellow-500/10",
    approved: "text-green-600 bg-green-500/10",
    rejected: "text-destructive bg-destructive/10",
    implemented: "text-blue-600 bg-blue-500/10",
    merged: "text-purple-600 bg-purple-500/10",
    archived: "text-muted-foreground bg-muted",
  };

  return (
    <Card className="bg-card border-border hover:border-input transition-colors">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-foreground">{blueprint.name}</CardTitle>
              <Badge className={statusColors[blueprint.status]}>
                {blueprint.status}
              </Badge>
              <Badge className={riskColors[blueprint.riskLevel]}>
                {blueprint.riskLevel} risk
              </Badge>
            </div>
            <CardDescription className="text-muted-foreground">
              {blueprint.problemStatement}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="flex gap-6 text-sm">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {blueprint.frequency} occurrences
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {blueprint.affectedUsers} users
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {blueprint.estimatedImpact.timesSaved} saves/month
            </span>
          </div>
        </div>

        {/* Primitives */}
        <div>
          <div className="text-xs text-muted-foreground mb-2">Primitives Used:</div>
          <div className="flex flex-wrap gap-2">
            {blueprint.primitivesUsed.map((primitive, i) => (
              <Badge key={i} variant="outline" className="border-border text-muted-foreground">
                {primitive}
              </Badge>
            ))}
          </div>
        </div>

        {/* Impact */}
        <div className="bg-muted p-3 rounded text-sm space-y-1">
          <p className="text-muted-foreground">
            <AlertTriangle className="w-3 h-3 inline mr-1" />
            {blueprint.estimatedImpact.regretPrevention}
          </p>
        </div>

        {/* Actions */}
        {onSelect && blueprint.status === "proposed" && (
          <div className="flex gap-2">
            <Button
              onClick={() => onSelect(blueprint)}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              Review Blueprint
            </Button>
          </div>
        )}

        {blueprint.reviewNotes && (
          <div className="bg-muted p-3 rounded text-sm">
            <div className="text-muted-foreground mb-1">Review Notes:</div>
            <p className="text-muted-foreground">{blueprint.reviewNotes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
