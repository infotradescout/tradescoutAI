import { memo } from 'react';
import { Shield, Users, FileText, BarChart3, Settings, AlertTriangle, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface AdminStats {
  totalUsers: number;
  totalContractors?: number;
  newLeads?: number;
  totalRecommendations?: number;
  roleBreakdown: {
    homeowner: number;
    contractor: number;
    handyman: number;
    realtor: number;
  };
  unknownRoleCount: number;
  unknownRoles: Record<string, number>;
  totalCommunityPosts: number;
}

interface ObservabilitySummary {
  timestamp: string;
  scheduler: Array<{
    jobName: string;
    totalRuns: number;
    errorCount: number;
    overlapCount: number;
    duration: { p50: number; p95: number; p99: number } | null;
    rowsWritten: { min: number; avg: number; max: number };
  }>;
  dbPool: {
    current: {
      active: number;
      idle: number;
      waiting: number;
    };
  };
  http: {
    statusClasses: Record<string, number>;
    total: number;
  };
}

interface ObservabilityAlerts {
  active: Array<{
    id: string;
    severity: string;
    name: string;
    description: string;
    startedAt: string;
  }>;
  history: Array<{
    id: string;
    severity: string;
    name: string;
    description: string;
    resolvedAt?: string;
  }>;
  total: number;
}

interface AuditLogEntry {
  type: string;
  userId?: string;
  adminId?: string;
  newRole?: string;
  targetUserId?: string;
  timestamp?: string;
}

interface AuditLogResponse {
  log: AuditLogEntry[];
}

const AdministrativeDashboard = memo(function AdministrativeDashboard() {
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ['/api/admin/stats'],
  });
  const { data: observabilitySummary } = useQuery<ObservabilitySummary>({
    queryKey: ['/api/admin/observability/summary'],
  });
  const { data: observabilityAlerts } = useQuery<ObservabilityAlerts>({
    queryKey: ['/api/admin/observability/alerts'],
  });
  const {
    data: auditLog,
    isError: auditLogError,
  } = useQuery<AuditLogResponse>({
    queryKey: ['/api/admin/audit-log'],
    retry: false,
    queryFn: async () => apiRequest('GET', '/api/admin/audit-log'),
  });

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold text-foreground">Administrative Dashboard</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Platform oversight and management controls
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Active Alerts</p>
                  <p className="text-2xl font-bold text-foreground">
                    {observabilityAlerts?.total ?? 0}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Total Users</p>
                  <p className="text-2xl font-bold text-foreground">
                    {isLoading ? '...' : (stats?.totalUsers || 0).toLocaleString()}
                  </p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Community Posts</p>
                  <p className="text-2xl font-bold text-yellow-500">
                    {isLoading ? '...' : (stats?.totalCommunityPosts || 0).toLocaleString()}
                  </p>
                </div>
                <FileText className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">New Leads (7d)</p>
                  <p className="text-2xl font-bold text-foreground">
                    {isLoading ? '...' : (stats?.newLeads || 0).toLocaleString()}
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Management Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* User Management */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-foreground font-medium">Total Registered Users</p>
                    <p className="text-muted-foreground text-sm">All time platform users</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-foreground">
                      {isLoading ? '...' : (stats?.totalUsers || 0).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    { role: "Homeowners", count: stats?.roleBreakdown.homeowner || 0, percentage: stats ? Math.round((stats.roleBreakdown.homeowner / stats.totalUsers) * 100) : 0 },
                    { role: "Contractors", count: stats?.roleBreakdown.contractor || 0, percentage: stats ? Math.round((stats.roleBreakdown.contractor / stats.totalUsers) * 100) : 0 },
                    { role: "Handymen", count: stats?.roleBreakdown.handyman || 0, percentage: stats ? Math.round((stats.roleBreakdown.handyman / stats.totalUsers) * 100) : 0 },
                    { role: "Realtors", count: stats?.roleBreakdown.realtor || 0, percentage: stats ? Math.round((stats.roleBreakdown.realtor / stats.totalUsers) * 100) : 0 },
                    { role: "Other Roles", count: stats?.unknownRoleCount || 0, percentage: stats ? Math.round((stats.unknownRoleCount / stats.totalUsers) * 100) : 0 }
                  ].map((role, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{role.role}</span>
                        <span className="text-foreground">{role.count.toLocaleString()}</span>
                      </div>
                      <Progress value={role.percentage} className="h-2" />
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button className="flex-1">
                    Manage Users
                  </Button>
                  <Button variant="outline" className="flex-1">
                    Export Data
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Monitoring */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                System Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!observabilitySummary ? (
                <div className="text-sm text-muted-foreground">
                  No observability snapshots available yet.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-foreground font-medium text-sm">Scheduler Jobs</p>
                    <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                      {observabilitySummary.scheduler.map((job) => (
                        <div key={job.jobName} className="flex flex-wrap justify-between">
                          <span>{job.jobName.replace(/_/g, ' ')}</span>
                          <span>
                            Runs {job.totalRuns} | Errors {job.errorCount} | Overlaps {job.overlapCount} | p95{' '}
                            {job.duration?.p95 ? `${job.duration.p95}ms` : 'n/a'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-foreground font-medium text-sm">DB Pool</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Active {observabilitySummary.dbPool.current.active} | Idle {observabilitySummary.dbPool.current.idle} | Waiting {observabilitySummary.dbPool.current.waiting}
                    </p>
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-foreground font-medium text-sm">HTTP Statuses</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Total {observabilitySummary.http.total} | 2xx {observabilitySummary.http.statusClasses['2xx'] || 0} | 4xx {observabilitySummary.http.statusClasses['4xx'] || 0} | 5xx {observabilitySummary.http.statusClasses['5xx'] || 0}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activities & Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Admin Actions */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Recent Admin Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {auditLogError ? (
                  <div className="text-sm text-muted-foreground">
                    Audit log requires super admin access.
                  </div>
                ) : (auditLog?.log?.length || 0) === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No recent admin actions recorded.
                  </div>
                ) : (
                  auditLog?.log?.slice(0, 6).map((entry, index) => (
                    <div key={`${entry.type}-${index}`} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <div className="flex-1">
                        <p className="text-foreground text-sm">{entry.type.replace(/_/g, ' ')}</p>
                        <p className="text-muted-foreground text-xs">
                          User {entry.userId || entry.targetUserId || 'n/a'} - Admin {entry.adminId || 'n/a'}
                        </p>
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'n/a'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* System Alerts */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                System Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(observabilityAlerts?.active?.length || 0) === 0 ? (
                  <div className="text-sm text-muted-foreground">No active alerts.</div>
                ) : (
                  observabilityAlerts?.active?.slice(0, 5).map((alert) => (
                    <div key={alert.id} className="p-4 bg-muted/50 rounded-lg border-l-4 border-l-orange-500">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-foreground font-medium text-sm">{alert.name}</h4>
                        <Badge
                          variant={alert.severity === 'CRITICAL' ? 'error' : 'secondary'}
                          className="text-xs"
                        >
                          {alert.severity.toLowerCase()}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm mb-3">{alert.description}</p>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>Started {alert.startedAt ? new Date(alert.startedAt).toLocaleString() : 'n/a'}</span>
                        <span>{alert.id}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Quick Actions */}
        <Card className="bg-card border-border mt-8">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Administrative Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Button className="h-24 flex flex-col items-center justify-center gap-2" variant="outline">
                <FileText className="h-6 w-6" />
                Generate Reports
              </Button>
              <Button className="h-24 flex flex-col items-center justify-center gap-2" variant="outline">
                <Users className="h-6 w-6" />
                User Management
              </Button>
              <Button className="h-24 flex flex-col items-center justify-center gap-2" variant="outline">
                <BarChart3 className="h-6 w-6" />
                System Analytics
              </Button>
              <Button className="h-24 flex flex-col items-center justify-center gap-2" variant="outline">
                <Settings className="h-6 w-6" />
                Platform Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

export default AdministrativeDashboard;

