import { memo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Phone, Mail, MapPin, Calendar, Clock, Filter, Search, TrendingUp, Wrench, DollarSign } from 'lucide-react';
import { getStatusColorClass } from '@/lib/colors';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';

interface DashboardProject {
  id: string;
  title: string;
  status?: string;
  value?: string | number | null;
  createdAt?: string | Date | null;
}

interface DashboardResponse {
  stats: {
    activeProjects: number;
  };
  myProjects?: DashboardProject[];
}

const ProjectTracker = memo(function ProjectTracker() {
  const { user } = useAuth();
  const [selectedProject, setSelectedProject] = useState<DashboardProject | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');

  const { data, isLoading } = useQuery<DashboardResponse>({
    queryKey: ['/api/dashboard', user?.id],
    enabled: !!user?.id,
  });

  const projects: (DashboardProject & { status: string })[] = (data?.myProjects ?? []).map((p) => ({
    ...p,
    status: p.status || 'new',
  }));

  const getStatusColor = (status: string) => {
    return getStatusColorClass(status);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'medium': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'low': return 'text-green-400 bg-green-400/10 border-green-400/20';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  const filteredProjects = filterStatus === 'all' 
    ? projects 
    : projects.filter(project => project.status === filterStatus);

          <CardContent>
            {isLoading ? (
              <div className="py-6 text-center text-sm text-gray-400">Loading projects...</div>
            ) : projects.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-400">No projects yet</div>
            ) : (
              <>
                <div className="space-y-3">
                  {filteredProjects.map((project) => (
                    <Card
                      key={project.id}
                      className="bg-slate-900/50 border-slate-700 hover:border-orange-500/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedProject(project)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold text-white">{project.title}</h3>
                              <Badge className={`${getStatusColor(project.status)} text-white border-0`}>
                                {project.status}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-400">
                              <div className="flex items-center gap-2">
                                <Wrench className="w-4 h-4" />
                                <span>{project.value ? `$${project.value}` : 'No estimate yet'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4" />
                                <span>Your area</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                <span>
                                  {project.createdAt
                                    ? `Added ${formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}`
                                    : 'Created recently'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 ml-4">
                            <Button variant="outline" size="sm" className="border-slate-700 hover:bg-slate-700">
                              <Phone className="w-4 h-4 mr-2" />
                              Call
                            </Button>
                            <Button variant="outline" size="sm" className="border-slate-700 hover:bg-slate-700">
                              <Mail className="w-4 h-4 mr-2" />
                              Message
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {selectedProject && (
                  <div className="mt-6 border-t border-slate-700 pt-4">
                    <h2 className="text-lg font-semibold text-white mb-2">Project details</h2>
                    <p className="text-sm text-gray-300 mb-1">{selectedProject.title}</p>
                    <p className="text-xs text-gray-400">
                      Status: {selectedProject.status} •
                      {" "}
                      {selectedProject.createdAt
                        ? `Added ${formatDistanceToNow(new Date(selectedProject.createdAt), { addSuffix: true })}`
                        : "Created recently"}
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-400">Projects Won</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-400">{projectStats.won}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <CardTitle className="text-white">All Projects</CardTitle>
                <CardDescription>Track and manage project requests</CardDescription>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input 
                    placeholder="Search projects..." 
                    className="pl-10 bg-slate-900/50 border-slate-700 text-white"
                  />
                </div>
                
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-40 bg-slate-900/50 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="quoted">Quoted</SelectItem>
                    <SelectItem value="proposal">Proposal</SelectItem>
                    <SelectItem value="won">Won</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="py-6 text-center text-sm text-gray-400">Loading projects...</div>
            ) : projects.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-400">No projects yet</div>
            ) : (
              <div className="space-y-3">
                {filteredProjects.map((project) => (
                  <Card key={project.id} className="bg-slate-900/50 border-slate-700 hover:border-orange-500/50 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-white">{project.title}</h3>
                            <Badge className={`${getStatusColor(project.status)} text-white border-0`}>
                              {project.status}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-400">
                            <div className="flex items-center gap-2">
                              <Wrench className="w-4 h-4" />
                              <span>{project.value ? `$${project.value}` : 'No estimate yet'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4" />
                              <span>Your area</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              <span>
                                {project.createdAt
                                  ? `Added ${formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}`
                                  : 'Created recently'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          <Button variant="outline" size="sm" className="border-slate-700 hover:bg-slate-700">
                            <Phone className="w-4 h-4 mr-2" />
                            Call
                          </Button>
                          <Button variant="outline" size="sm" className="border-slate-700 hover:bg-slate-700">
                            <Mail className="w-4 h-4 mr-2" />
                            Message
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

export default ProjectTracker;
