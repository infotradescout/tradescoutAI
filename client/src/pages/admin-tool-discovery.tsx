import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Clock, Sparkles, AlertTriangle, TrendingUp, Users, Zap } from "lucide-react";
import type { ToolBlueprint } from "../../server/scout/toolDiscovery";

export default function ToolDiscoveryAdmin() {
  const [blueprints, setBlueprints] = useState<ToolBlueprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBlueprint, setSelectedBlueprint] = useState<ToolBlueprint | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const { toast } = useToast();

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
      <div className="min-h-screen bg-charcoal-950 p-6 flex items-center justify-center">
        <div className="text-charcoal-100">Loading tool discoveries...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-charcoal-50 flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-scout-500" />
              Tool Discovery Dashboard
            </h1>
            <p className="text-charcoal-400 mt-2">
              Scout learns from real user friction and proposes new capabilities
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-charcoal-50">{proposedBlueprints.length}</div>
            <div className="text-sm text-charcoal-400">Pending Review</div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-charcoal-900 border-charcoal-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-charcoal-400">Proposed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-charcoal-50">{proposedBlueprints.length}</div>
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-charcoal-900 border-charcoal-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-charcoal-400">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-charcoal-50">{approvedBlueprints.length}</div>
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-charcoal-900 border-charcoal-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-charcoal-400">Total Patterns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-charcoal-50">
                  {blueprints.reduce((sum, b) => sum + b.frequency, 0)}
                </div>
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-charcoal-900 border-charcoal-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-charcoal-400">Affected Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-charcoal-50">
                  {new Set(blueprints.flatMap(b => b.exampleConversations.map(c => c.userId))).size}
                </div>
                <Users className="w-5 h-5 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="proposed" className="w-full">
          <TabsList className="bg-charcoal-900 border border-charcoal-800">
            <TabsTrigger value="proposed" className="data-[state=active]:bg-charcoal-800">
              Proposed ({proposedBlueprints.length})
            </TabsTrigger>
            <TabsTrigger value="approved" className="data-[state=active]:bg-charcoal-800">
              Approved ({approvedBlueprints.length})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="data-[state=active]:bg-charcoal-800">
              Rejected ({rejectedBlueprints.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="proposed" className="space-y-4 mt-6">
            {proposedBlueprints.length === 0 ? (
              <Card className="bg-charcoal-900 border-charcoal-800">
                <CardContent className="p-12 text-center">
                  <Sparkles className="w-12 h-12 text-charcoal-600 mx-auto mb-4" />
                  <p className="text-charcoal-400">No tool blueprints pending review</p>
                  <p className="text-sm text-charcoal-500 mt-2">
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
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
            <Card className="bg-charcoal-900 border-charcoal-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="text-charcoal-50">Review: {selectedBlueprint.name}</CardTitle>
                <CardDescription>Decide whether to implement this tool</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-charcoal-400 mb-2">Problem Statement</h3>
                  <p className="text-charcoal-200">{selectedBlueprint.problemStatement}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-charcoal-400 mb-2">Impact</h3>
                  <div className="space-y-1 text-sm text-charcoal-300">
                    <p>• {selectedBlueprint.estimatedImpact.timesSaved} saves per month</p>
                    <p>• {selectedBlueprint.estimatedImpact.outcomeImprovement}</p>
                    <p>• {selectedBlueprint.estimatedImpact.regretPrevention}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-charcoal-400 mb-2">Example Conversations</h3>
                  <div className="space-y-2">
                    {selectedBlueprint.exampleConversations.slice(0, 3).map((ex, i) => (
                      <div key={i} className="bg-charcoal-800 p-3 rounded text-sm">
                        <p className="text-charcoal-200">{ex.message}</p>
                        <p className="text-charcoal-500 mt-1">Workaround: {ex.workaround}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-charcoal-400 mb-2 block">
                    Review Notes
                  </label>
                  <Textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add notes about this decision..."
                    className="bg-charcoal-800 border-charcoal-700 text-charcoal-200"
                    rows={4}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => approveBlueprint(selectedBlueprint.id)}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Approve for Implementation
                  </Button>
                  <Button
                    onClick={() => rejectBlueprint(selectedBlueprint.id)}
                    variant="outline"
                    className="flex-1 border-red-600 text-red-400 hover:bg-red-950"
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
                    className="text-charcoal-400"
                  >
                    Cancel
                  </Button>
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
    low: "text-green-400 bg-green-950",
    medium: "text-yellow-400 bg-yellow-950",
    high: "text-red-400 bg-red-950",
  };

  const statusColors = {
    proposed: "text-yellow-400 bg-yellow-950",
    approved: "text-green-400 bg-green-950",
    rejected: "text-red-400 bg-red-950",
    implemented: "text-blue-400 bg-blue-950",
    merged: "text-purple-400 bg-purple-950",
  };

  return (
    <Card className="bg-charcoal-900 border-charcoal-800 hover:border-charcoal-700 transition-colors">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-charcoal-50">{blueprint.name}</CardTitle>
              <Badge className={statusColors[blueprint.status]}>
                {blueprint.status}
              </Badge>
              <Badge className={riskColors[blueprint.riskLevel]}>
                {blueprint.riskLevel} risk
              </Badge>
            </div>
            <CardDescription className="text-charcoal-400">
              {blueprint.problemStatement}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="flex gap-6 text-sm">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-charcoal-500" />
            <span className="text-charcoal-400">
              {blueprint.frequency} occurrences
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-charcoal-500" />
            <span className="text-charcoal-400">
              {blueprint.affectedUsers} users
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-charcoal-500" />
            <span className="text-charcoal-400">
              {blueprint.estimatedImpact.timesSaved} saves/month
            </span>
          </div>
        </div>

        {/* Primitives */}
        <div>
          <div className="text-xs text-charcoal-500 mb-2">Primitives Used:</div>
          <div className="flex flex-wrap gap-2">
            {blueprint.primitivesUsed.map((primitive, i) => (
              <Badge key={i} variant="outline" className="border-charcoal-700 text-charcoal-300">
                {primitive}
              </Badge>
            ))}
          </div>
        </div>

        {/* Impact */}
        <div className="bg-charcoal-800 p-3 rounded text-sm space-y-1">
          <p className="text-charcoal-300">
            <AlertTriangle className="w-3 h-3 inline mr-1" />
            {blueprint.estimatedImpact.regretPrevention}
          </p>
        </div>

        {/* Actions */}
        {onSelect && blueprint.status === "proposed" && (
          <div className="flex gap-2">
            <Button
              onClick={() => onSelect(blueprint)}
              className="flex-1 bg-scout-600 hover:bg-scout-700"
            >
              Review Blueprint
            </Button>
          </div>
        )}

        {blueprint.reviewNotes && (
          <div className="bg-charcoal-800 p-3 rounded text-sm">
            <div className="text-charcoal-500 mb-1">Review Notes:</div>
            <p className="text-charcoal-300">{blueprint.reviewNotes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
