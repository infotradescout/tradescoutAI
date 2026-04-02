import { memo, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Headphones,
  Plus,
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users2,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getPriorityColorClass, getCategoryColorClass } from "@/lib/colors";
import { apiRequest } from "@/lib/queryClient";

type ErrorReport = {
  id: string;
  title: string;
  description: string;
  errorType?: "bug" | "ui_issue" | "performance" | "feature_request" | "other" | string;
  status?: "open" | "in_progress" | "resolved" | "closed" | "duplicate" | string;
  priority?: "low" | "medium" | "high" | "critical" | string;
  userEmail?: string | null;
  assignedTo?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  resolvedAt?: string | null;
};

const EMPTY_REPORT_STATS = {
  total: 0,
  open: 0,
  inProgress: 0,
  resolved: 0,
};

const SupportTickets = memo(function SupportTickets() {
  const [activeTab, setActiveTab] = useState("open");
  const [selectedTicket, setSelectedTicket] = useState<ErrorReport | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading } = useQuery<ErrorReport[]>({
    queryKey: ["/api/admin/error-reports"],
    queryFn: () => apiRequest("GET", "/api/admin/error-reports"),
  });

  const { data: reportStats = EMPTY_REPORT_STATS } = useQuery<{
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
  }>({
    queryKey: ["/api/admin/error-report-stats"],
    queryFn: () => apiRequest("GET", "/api/admin/error-report-stats"),
  });

  const openTickets = useMemo(
    () => reports.filter((ticket) => ["open", "in_progress"].includes(String(ticket.status))),
    [reports]
  );
  const resolvedTickets = useMemo(
    () => reports.filter((ticket) => ["resolved", "closed"].includes(String(ticket.status))),
    [reports]
  );

  const resolvedToday = useMemo(() => {
    const today = new Date().toDateString();
    return reports.filter((ticket) => {
      if (!ticket.resolvedAt) return false;
      const resolvedAt = new Date(ticket.resolvedAt);
      if (Number.isNaN(resolvedAt.getTime())) return false;
      return resolvedAt.toDateString() === today;
    }).length;
  }, [reports]);

  const avgResponseHours = useMemo(() => {
    const resolved = reports.filter((ticket) => ticket.resolvedAt && ticket.createdAt);
    if (resolved.length === 0) return null;
    const totalMs = resolved.reduce((acc, ticket) => {
      const created = ticket.createdAt ? new Date(ticket.createdAt) : null;
      const resolvedAt = ticket.resolvedAt ? new Date(ticket.resolvedAt) : null;
      if (!created || !resolvedAt) return acc;
      const createdMs = created.getTime();
      const resolvedMs = resolvedAt.getTime();
      if (Number.isNaN(createdMs) || Number.isNaN(resolvedMs)) return acc;
      return acc + Math.max(0, resolvedMs - createdMs);
    }, 0);
    const avgMs = totalMs / resolved.length;
    return avgMs > 0 ? Number((avgMs / (1000 * 60 * 60)).toFixed(1)) : null;
  }, [reports]);

  const updateTicketMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ErrorReport> }) =>
      apiRequest("PATCH", `/api/admin/error-reports/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/error-reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/error-report-stats"] });
    },
  });

  const handleAssignTicket = (ticketId: string, agent: string) => {
    updateTicketMutation.mutate(
      { id: ticketId, updates: { assignedTo: agent } },
      {
        onSuccess: () =>
          toast({
            title: "Ticket Assigned",
            description: `Ticket has been assigned to ${agent}.`,
          }),
      }
    );
  };

  const handleUpdateStatus = (ticketId: string, status: string) => {
    updateTicketMutation.mutate(
      { id: ticketId, updates: { status } },
      {
        onSuccess: () =>
          toast({
            title: "Status Updated",
            description: `Ticket status has been updated to ${status}.`,
          }),
      }
    );
  };

  const getStatusIcon = (status?: string | null) => {
    switch (status ?? "open") {
      case "open":
        return <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
      case "resolved":
        return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case "closed":
        return <XCircle className="h-4 w-4 text-muted-foreground" />;
      default:
        return <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    return getPriorityColorClass(priority);
  };

  const getCategoryColor = (category: string) => {
    return getCategoryColorClass(category);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Headphones className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-4xl font-bold text-foreground">Support Tickets</h1>
              <p className="text-muted-foreground text-lg">
                Manage customer support requests and issues
              </p>
            </div>
          </div>
          <Button className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            New Ticket
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Open Tickets</p>
                <p className="text-2xl font-bold text-foreground">
                  {reportStats.open ?? openTickets.length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">In Progress</p>
                <p className="text-2xl font-bold text-foreground">{reportStats.inProgress ?? 0}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Resolved Today</p>
                <p className="text-2xl font-bold text-foreground">{resolvedToday}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Avg Response Time</p>
                <p className="text-2xl font-bold text-foreground">
                  {avgResponseHours != null ? `${avgResponseHours}h` : "n/a"}
                </p>
              </div>
              <Users2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Tickets List */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="flex items-center justify-between">
              <TabsList className="bg-muted border border-border">
                <TabsTrigger
                  value="open"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  Open ({openTickets.length})
                </TabsTrigger>
                <TabsTrigger
                  value="resolved"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  Resolved ({resolvedTickets.length})
                </TabsTrigger>
                <TabsTrigger
                  value="all"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  All Tickets
                </TabsTrigger>
              </TabsList>

              <Button
                variant="outline"
                size="sm"
                className="border-primary text-primary hover:bg-primary/10"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </div>

            <TabsContent value="open" className="space-y-4">
              {isLoading ? (
                <Card className="bg-card border-border">
                  <CardContent className="p-6 text-muted-foreground">
                    Loading tickets...
                  </CardContent>
                </Card>
              ) : openTickets.length === 0 ? (
                <Card className="bg-card border-border">
                  <CardContent className="p-6 text-muted-foreground">No open tickets.</CardContent>
                </Card>
              ) : (
                openTickets.map((ticket) => (
                  <Card
                    key={ticket.id}
                    className={`bg-card border-border cursor-pointer transition-colors hover:bg-muted/50 ${selectedTicket?.id === ticket.id ? "ring-2 ring-primary" : ""}`}
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(ticket.status)}
                          <div>
                            <h3 className="text-foreground font-medium">{ticket.title}</h3>
                            <p className="text-muted-foreground text-sm">
                              #{ticket.id} - {ticket.userEmail || "Unknown user"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={getPriorityColor(ticket.priority || "medium")}
                          >
                            {(ticket.priority || "medium").toUpperCase()}
                          </Badge>
                          <Badge className={getCategoryColor(ticket.errorType || "other")}>
                            {(ticket.errorType || "other").replace(/_/g, " ")}
                          </Badge>
                        </div>
                      </div>

                      <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                        {ticket.description}
                      </p>

                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-4">
                          <span>Assigned to: {ticket.assignedTo || "Unassigned"}</span>
                          <span>Status: {ticket.status || "open"}</span>
                        </div>
                        <span>
                          {ticket.updatedAt
                            ? new Date(ticket.updatedAt).toLocaleDateString()
                            : "n/a"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="resolved" className="space-y-4">
              {isLoading ? (
                <Card className="bg-card border-border">
                  <CardContent className="p-6 text-muted-foreground">
                    Loading tickets...
                  </CardContent>
                </Card>
              ) : resolvedTickets.length === 0 ? (
                <Card className="bg-card border-border">
                  <CardContent className="p-6 text-muted-foreground">
                    No resolved tickets.
                  </CardContent>
                </Card>
              ) : (
                resolvedTickets.map((ticket) => (
                  <Card
                    key={ticket.id}
                    className="bg-card border-border cursor-pointer transition-colors hover:bg-muted/50"
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(ticket.status)}
                          <div>
                            <h3 className="text-foreground font-medium">{ticket.title}</h3>
                            <p className="text-muted-foreground text-sm">
                              #{ticket.id} - {ticket.userEmail || "Unknown user"}
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-green-600 text-white">RESOLVED</Badge>
                      </div>

                      <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                        {ticket.description}
                      </p>

                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Resolved by: {ticket.assignedTo || "Unassigned"}</span>
                        <span>
                          {ticket.resolvedAt
                            ? new Date(ticket.resolvedAt).toLocaleDateString()
                            : "n/a"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Ticket Detail */}
        <div className="space-y-6">
          {selectedTicket ? (
            <>
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Ticket #{selectedTicket.id}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{(selectedTicket.userEmail || "U")[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-foreground font-medium">
                        {selectedTicket.userEmail || "Unknown user"}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {selectedTicket.userEmail || "No email"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-foreground font-medium mb-2">Subject</h4>
                    <p className="text-muted-foreground">{selectedTicket.title}</p>
                  </div>

                  <div>
                    <h4 className="text-foreground font-medium mb-2">Description</h4>
                    <p className="text-muted-foreground">{selectedTicket.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-foreground">Priority</Label>
                      <Select
                        defaultValue={selectedTicket.priority || "medium"}
                        onValueChange={(value) =>
                          updateTicketMutation.mutate({
                            id: selectedTicket.id,
                            updates: { priority: value },
                          })
                        }
                      >
                        <SelectTrigger className="bg-background border-input text-foreground">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-foreground">Status</Label>
                      <Select
                        defaultValue={selectedTicket.status || "open"}
                        onValueChange={(value) => handleUpdateStatus(selectedTicket.id, value)}
                      >
                        <SelectTrigger className="bg-background border-input text-foreground">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-foreground">Assign To</Label>
                    <Select
                      defaultValue={selectedTicket.assignedTo || "Unassigned"}
                      onValueChange={(value) => handleAssignTicket(selectedTicket.id, value)}
                    >
                      <SelectTrigger className="bg-background border-input text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sarah Wilson">Sarah Wilson</SelectItem>
                        <SelectItem value="Tom Davis">Tom Davis</SelectItem>
                        <SelectItem value="Mike Chen">Mike Chen</SelectItem>
                        <SelectItem value="Unassigned">Unassigned</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleUpdateStatus(selectedTicket.id, "resolved")}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Mark as Resolved
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full border-primary text-primary hover:bg-primary/10"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Add Response
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">Quick Response</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Type your response to the customer..."
                    className="bg-background border-input text-foreground"
                    rows={4}
                  />
                  <Button className="w-full bg-primary hover:bg-primary/90">Send Response</Button>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="p-12 text-center">
                <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-foreground text-xl mb-2">Select a Ticket</h3>
                <p className="text-muted-foreground">
                  Choose a ticket from the list to view details and respond
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
});

export default SupportTickets;
