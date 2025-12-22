import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bug, ExternalLink, Clock, CheckCircle, XCircle, AlertTriangle, User, Calendar, Globe, Smartphone, Monitor } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ErrorReport } from "@shared/schema";

export default function AdminErrorReports() {
  const [selectedReport, setSelectedReport] = useState<ErrorReport | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["/api/admin/error-reports"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/error-reports");
      return (res ?? []) as ErrorReport[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/admin/error-reports/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/error-reports'] });
      toast({
        title: "Report Updated",
        description: "The error report has been updated successfully.",
      });
    },
  });

  const filteredReports = reports.filter((report: ErrorReport) => {
    if (filterStatus !== "all" && report.status !== filterStatus) return false;
    if (filterType !== "all" && report.errorType !== filterType) return false;
    return true;
  });

  const safeStatus = (status?: string | null) => status || 'open';
  const safePriority = (priority?: string | null) => priority || 'medium';
  const safeType = (type?: string | null) => type || 'bug';

  const getSafePathname = (rawUrl?: string | null) => {
    if (!rawUrl) return null;

    try {
      const base = typeof window !== 'undefined' ? window.location.origin : 'https://app.tradescout.co';
      const url = new URL(rawUrl, base);
      return url.pathname || url.toString();
    } catch {
      return rawUrl;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-500/20 text-red-500';
      case 'in_progress': return 'bg-yellow-500/20 text-yellow-500';
      case 'resolved': return 'bg-green-500/20 text-green-500';
      case 'closed': return 'bg-[#0f1419]/20 text-gray-500';
      case 'duplicate': return 'bg-blue-500/20 text-blue-500';
      default: return 'bg-[#0f1419]/20 text-gray-500';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-green-500/20 text-green-500';
      case 'medium': return 'bg-yellow-500/20 text-yellow-500';
      case 'high': return 'bg-orange-500/20 text-orange-500';
      case 'critical': return 'bg-red-500/20 text-red-500';
      default: return 'bg-[#0f1419]/20 text-gray-500';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bug': return <Bug className="h-4 w-4" />;
      case 'performance': return <Clock className="h-4 w-4" />;
      case 'ui_issue': return <Monitor className="h-4 w-4" />;
      case 'feature_request': return <AlertTriangle className="h-4 w-4" />;
      case 'automatic_screenshot': return <Smartphone className="h-4 w-4" />;
      default: return <Bug className="h-4 w-4" />;
    }
  };

  const renderScreenshot = (attachments: any) => {
    if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
      return null;
    }

    const screenshot = attachments.find((att: any) => att.type === 'screenshot');
    if (!screenshot || !screenshot.data) {
      return null;
    }

    return (
      <div className="mt-4">
        <Label className="text-sm font-medium text-gray-300 mb-2 block">Screenshot</Label>
        <div className="border border-gray-600 rounded-lg overflow-hidden">
          <img 
            src={screenshot.data} 
            alt="Bug report screenshot" 
            className="w-full h-auto max-h-96 object-contain bg-[#1a2332]"
            style={{ imageRendering: 'auto' }}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => {
            const link = document.createElement('a');
            link.href = screenshot.data;
            link.download = `bug-report-screenshot-${selectedReport?.id}.jpeg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}
        >
          Download Screenshot
        </Button>
      </div>
    );
  };

  const handleStatusChange = (reportId: string, newStatus: string) => {
    updateMutation.mutate({
      id: reportId,
      data: { status: newStatus }
    });
  };

  const handlePriorityChange = (reportId: string, newPriority: string) => {
    updateMutation.mutate({
      id: reportId,
      data: { priority: newPriority }
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-navy-900 text-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-navy-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-900 text-white">
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Error Reports</h1>
          <p className="text-gray-400">Manage bug reports and user feedback</p>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48 bg-navy-700 border-navy-600 text-white">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="bg-navy-700 border-navy-600">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="duplicate">Duplicate</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-48 bg-navy-700 border-navy-600 text-white">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent className="bg-navy-700 border-navy-600">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="bug">Bug/Error</SelectItem>
              <SelectItem value="ui_issue">UI Issue</SelectItem>
              <SelectItem value="performance">Performance</SelectItem>
              <SelectItem value="feature_request">Feature Request</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reports List */}
        <div className="space-y-4">
          {filteredReports.map((report: ErrorReport) => (
            <Card key={report.id} className="bg-navy-700 border-navy-600">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getTypeIcon(safeType(report.errorType))}
                      <h3 className="text-lg font-semibold text-white">{report.title}</h3>
                      <Badge className={getStatusColor(safeStatus(report.status))}>
                        {safeStatus(report.status).replace('_', ' ').toUpperCase()}
                      </Badge>
                      <Badge className={getPriorityColor(safePriority(report.priority))}>
                        {safePriority(report.priority).toUpperCase()}
                      </Badge>
                    </div>
                    
                    <p className="text-gray-300 mb-3 line-clamp-2">{report.description}</p>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {report.createdAt ? new Date(report.createdAt).toLocaleDateString() : 'Unknown'}
                      </div>
                      {report.userEmail && (
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          {report.userEmail}
                        </div>
                      )}
                      {report.currentUrl && (
                        <div className="flex items-center gap-1">
                          <Globe className="h-4 w-4" />
                          <span className="truncate max-w-40">
                            {getSafePathname(report.currentUrl) ?? 'Unknown'}
                          </span>
                        </div>
                      )}
                      {report.browserInfo?.mobile && (
                        <div className="flex items-center gap-1">
                          <Smartphone className="h-4 w-4" />
                          Mobile
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <Select
                      value={safeStatus(report.status)}
                      onValueChange={(value) => handleStatusChange(report.id, value)}
                    >
                      <SelectTrigger className="w-32 bg-navy-600 border-navy-500 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-navy-700 border-navy-600">
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="duplicate">Duplicate</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={safePriority(report.priority)}
                      onValueChange={(value) => handlePriorityChange(report.id, value)}
                    >
                      <SelectTrigger className="w-28 bg-navy-600 border-navy-500 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-navy-700 border-navy-600">
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      onClick={() => setSelectedReport(report)}
                      variant="outline"
                      size="sm"
                      className="border-navy-500 text-gray-300"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredReports.length === 0 && (
          <Card className="bg-navy-700 border-navy-600">
            <CardContent className="p-8 text-center">
              <Bug className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No Reports Found</h3>
              <p className="text-gray-300">No error reports match your current filters.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Report Detail Modal */}
      {selectedReport && (
        <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
          <DialogContent className="sm:max-w-[700px] bg-navy-800 border-navy-600 max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                {getTypeIcon(safeType(selectedReport.errorType))}
                {selectedReport.title}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              <div className="flex gap-2">
                <Badge className={getStatusColor(safeStatus(selectedReport.status))}>
                  {safeStatus(selectedReport.status).replace('_', ' ').toUpperCase()}
                </Badge>
                <Badge className={getPriorityColor(safePriority(selectedReport.priority))}>
                  {safePriority(selectedReport.priority).toUpperCase()}
                </Badge>
                <Badge variant="outline" className="border-navy-500 text-gray-300">
                  {safeType(selectedReport.errorType).replace('_', ' ').toUpperCase()}
                </Badge>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-2">Description</h4>
                <p className="text-white bg-navy-700 p-3 rounded border border-navy-600">
                  {selectedReport.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">User Information</h4>
                  <div className="space-y-1 text-sm text-gray-400">
                    <p>Email: {selectedReport.userEmail || 'Anonymous'}</p>
                    <p>User ID: {selectedReport.userId || 'N/A'}</p>
                    <p>Date: {selectedReport.createdAt ? new Date(selectedReport.createdAt).toLocaleString() : 'Unknown'}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">Technical Details</h4>
                  <div className="space-y-1 text-sm text-gray-400">
                    <p>Browser: {selectedReport.browserInfo?.name} {selectedReport.browserInfo?.version}</p>
                    <p>Platform: {selectedReport.browserInfo?.platform}</p>
                    <p>Mobile: {selectedReport.browserInfo?.mobile ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </div>

              {selectedReport.currentUrl && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">Page URL</h4>
                  <p className="text-blue-400 text-sm break-all bg-navy-700 p-2 rounded border border-navy-600">
                    {selectedReport.currentUrl}
                  </p>
                </div>
              )}

              {/* Screenshot Display */}
              {renderScreenshot(selectedReport.attachments)}

              {selectedReport.adminNotes && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">Admin Notes</h4>
                  <p className="text-white bg-navy-700 p-3 rounded border border-navy-600">
                    {selectedReport.adminNotes}
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}