
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, CheckCircle, XCircle, Clock, Zap, FileCode, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CodeFix {
  id: string;
  issueId: string;
  description: string;
  filePath: string;
  originalCode: string;
  fixedCode: string;
  confidence: number;
  status: 'pending' | 'applied' | 'failed' | 'rejected';
  timestamp: Date;
  aiReasoning: string;
}

export function AICodeFixingDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: fixes, isLoading } = useQuery({
    queryKey: ["/api/ai/fixes"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const applyFixMutation = useMutation({
    mutationFn: async (fixId: string) => {
      const response = await fetch(`/api/ai/apply-fix/${fixId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to apply fix');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Fix Applied",
          description: "The AI-generated code fix has been applied successfully.",
        });
      } else {
        toast({
          title: "Fix Failed",
          description: "Failed to apply the fix. Check logs for details.",
          variant: "destructive",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/ai/fixes"] });
    },
  });

  const autoFixMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/ai/auto-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to auto-apply fixes');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Auto-Fix Complete",
        description: "All high-confidence fixes have been applied automatically.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/fixes"] });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'applied': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-gray-500" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'bg-green-500';
    if (confidence >= 0.7) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const pendingFixes = fixes?.fixes?.filter((fix: CodeFix) => fix.status === 'pending') || [];
  const appliedFixes = fixes?.fixes?.filter((fix: CodeFix) => fix.status === 'applied') || [];
  const highConfidencePending = pendingFixes.filter((fix: CodeFix) => fix.confidence >= 0.9);

  if (isLoading) {
    return (
      <Card className="bg-navy-800 border-navy-600">
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <Bot className="h-5 w-5 animate-spin text-blue-500" />
            <span className="text-white">Loading AI Code Fixing Dashboard...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Bot className="h-8 w-8" />
              <div>
                <h2 className="text-2xl font-bold">AI Code Fixing</h2>
                <p className="opacity-90">Autonomous bug detection and code repair</p>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={() => autoFixMutation.mutate()}
                disabled={autoFixMutation.isPending || highConfidencePending.length === 0}
                className="bg-white text-blue-600 hover:bg-gray-100"
              >
                <Zap className="h-4 w-4 mr-2" />
                Auto-Fix ({highConfidencePending.length})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-gray-300 text-sm">Pending Fixes</p>
                <p className="text-2xl font-bold text-white">{pendingFixes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-gray-300 text-sm">Applied Fixes</p>
                <p className="text-2xl font-bold text-white">{appliedFixes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-gray-300 text-sm">High Confidence</p>
                <p className="text-2xl font-bold text-white">{highConfidencePending.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileCode className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-gray-300 text-sm">Total Fixes</p>
                <p className="text-2xl font-bold text-white">{fixes?.fixes?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fixes List */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList className="bg-navy-700 border-navy-600">
          <TabsTrigger value="pending" className="data-[state=active]:bg-navy-600">
            Pending ({pendingFixes.length})
          </TabsTrigger>
          <TabsTrigger value="applied" className="data-[state=active]:bg-navy-600">
            Applied ({appliedFixes.length})
          </TabsTrigger>
          <TabsTrigger value="all" className="data-[state=active]:bg-navy-600">
            All Fixes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {pendingFixes.map((fix: CodeFix) => (
                <Card key={fix.id} className="bg-navy-700 border-navy-600">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          {getStatusIcon(fix.status)}
                          <h4 className="text-white font-medium">{fix.description}</h4>
                          <Badge className={`text-white ${getConfidenceColor(fix.confidence)}`}>
                            {(fix.confidence * 100).toFixed(0)}% confidence
                          </Badge>
                        </div>
                        <p className="text-gray-300 text-sm mb-2">{fix.filePath}</p>
                        <p className="text-gray-400 text-xs">{fix.aiReasoning}</p>
                      </div>
                      <Button
                        onClick={() => applyFixMutation.mutate(fix.id)}
                        disabled={applyFixMutation.isPending}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Apply Fix
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {pendingFixes.length === 0 && (
                <Card className="bg-navy-700 border-navy-600">
                  <CardContent className="p-8 text-center">
                    <Bot className="h-12 w-12 mx-auto text-gray-500 mb-4" />
                    <p className="text-gray-300">No pending fixes available</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="applied">
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {appliedFixes.map((fix: CodeFix) => (
                <Card key={fix.id} className="bg-navy-700 border-navy-600">
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      {getStatusIcon(fix.status)}
                      <div className="flex-1">
                        <h4 className="text-white font-medium">{fix.description}</h4>
                        <p className="text-gray-300 text-sm">{fix.filePath}</p>
                        <p className="text-gray-400 text-xs">
                          Applied {new Date(fix.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <Badge className="bg-green-600">Applied</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="all">
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {fixes?.fixes?.map((fix: CodeFix) => (
                <Card key={fix.id} className="bg-navy-700 border-navy-600">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        {getStatusIcon(fix.status)}
                        <div className="flex-1">
                          <h4 className="text-white font-medium">{fix.description}</h4>
                          <p className="text-gray-300 text-sm">{fix.filePath}</p>
                          <p className="text-gray-400 text-xs">
                            {new Date(fix.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Badge className={`text-white ${getConfidenceColor(fix.confidence)}`}>
                          {(fix.confidence * 100).toFixed(0)}%
                        </Badge>
                        <Badge variant="outline">{fix.status}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
