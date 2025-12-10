import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Search, 
  MapPin, 
  Clock, 
  DollarSign, 
  Star, 
  Shield, 
  CheckCircle,
  Users,
  Briefcase,
  Plus,
  Filter
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { HelperProfileModal } from "@/components/HelperProfileModal";
import type { Worker, Task, TaskCategory } from "@shared/schema";

type HelperCardProps = {
  worker: Worker;
  onViewProfile: () => void;
};

export default function WorkerMarketplace() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("find-workers");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [sortBy, setSortBy] = useState("rating");
  const [selectedHelper, setSelectedHelper] = useState<Worker | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Fetch workers
  const { data: workers, isLoading: workersLoading } = useQuery<Worker[]>({
    queryKey: ['/api/workers', selectedCategory, locationFilter, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (locationFilter) params.append('location', locationFilter);
      if (sortBy) params.append('sort', sortBy);
      
      const response = await fetch(`/api/workers?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch workers');
      return response.json();
    },
    enabled: activeTab === "find-workers",
  });

  // Fetch tasks
  const { data: tasks, isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ['/api/tasks', selectedCategory, locationFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (locationFilter) params.append('location', locationFilter);
      
      const response = await fetch(`/api/tasks?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch tasks');
      return response.json();
    },
    enabled: activeTab === "find-tasks",
  });

  // Fetch task categories
  const { data: categories } = useQuery<TaskCategory[]>({
    queryKey: ['/api/task-categories'],
  });

  // Filter workers based on search
  const filteredWorkers = useMemo(() => {
    if (!workers) return [];
    
    return workers.filter(worker => {
      const matchesSearch = !searchQuery || 
        `${worker.firstName} ${worker.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        worker.bio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        worker.skills?.some(skill => skill.toLowerCase().includes(searchQuery.toLowerCase()));
      
      return matchesSearch;
    });
  }, [workers, searchQuery]);

  // Filter tasks based on search
  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    
    return tasks.filter(task => {
      const matchesSearch = !searchQuery || 
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.requiredSkills?.some(skill => skill.toLowerCase().includes(searchQuery.toLowerCase()));
      
      return matchesSearch;
    });
  }, [tasks, searchQuery]);

  return (
    <div className="min-h-screen bg-navy-900 text-white">
      <div className="max-w-7xl mx-auto ts-surface px-4 py-6 md:px-10 md:py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">Helpers</h1>
        <p className="text-xl text-gray-300 max-w-3xl">
          Two-way marketplace: Contractors can hire helpers as employees for ongoing work, 
          and homeowners can hire helpers for odd jobs and one-time tasks. 
          All helpers are ID verified and background checked for your peace of mind.
        </p>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
        <TabsList className="grid w-full grid-cols-2 bg-navy-700 border-navy-600">
          <TabsTrigger value="find-workers" className="data-[state=active]:bg-orange-500">
            <Users className="h-4 w-4 mr-2" />
            Find Helpers
          </TabsTrigger>
          <TabsTrigger value="find-tasks" className="data-[state=active]:bg-orange-500">
            <Briefcase className="h-4 w-4 mr-2" />
            Find Tasks
          </TabsTrigger>
        </TabsList>

        {/* Search and Filters */}
        <div className="mt-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder={activeTab === "find-workers" ? "Search helpers..." : "Search tasks..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-navy-600 border-navy-500 text-white"
              />
            </div>
            
            <Select value={selectedCategory || "all"} onValueChange={(value) => setSelectedCategory(value === "all" ? "" : value)}>
              <SelectTrigger className="bg-navy-600 border-navy-500 text-white">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent className="bg-navy-600 border-navy-500">
                <SelectItem value="all">All categories</SelectItem>
                {categories?.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Location (city, zip)"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="bg-navy-600 border-navy-500 text-white"
            />

            {activeTab === "find-workers" && (
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="bg-navy-600 border-navy-500 text-white">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="bg-navy-600 border-navy-500">
                  <SelectItem value="rating">Highest Rated</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="jobs-completed">Most Jobs Completed</SelectItem>
                  <SelectItem value="newest">Newest Members</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Find Helpers Tab */}
        <TabsContent value="find-workers">
          {workersLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="bg-navy-700 border-navy-600 animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-4 bg-navy-600 rounded mb-4"></div>
                    <div className="h-16 bg-navy-600 rounded mb-4"></div>
                    <div className="h-4 bg-navy-600 rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredWorkers.map((worker) => (
                <HelperCard 
                  key={worker.id} 
                  worker={worker} 
                  onViewProfile={() => {
                    setSelectedHelper(worker);
                    setIsProfileModalOpen(true);
                  }}
                />
              ))}
              {filteredWorkers.length === 0 && (
                <div className="col-span-full">
                  <Card className="bg-navy-700 border-navy-600">
                    <CardContent className="p-8 text-center">
                      <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-white mb-2">No helpers found</h3>
                      <p className="text-gray-300">Try adjusting your search criteria or filters.</p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Find Tasks Tab */}
        <TabsContent value="find-tasks">
          {tasksLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="bg-navy-700 border-navy-600 animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-4 bg-navy-600 rounded mb-4"></div>
                    <div className="h-20 bg-navy-600 rounded mb-4"></div>
                    <div className="h-4 bg-navy-600 rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
              {filteredTasks.length === 0 && (
                <div className="col-span-full">
                  <Card className="bg-navy-700 border-navy-600">
                    <CardContent className="p-8 text-center">
                      <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-white mb-2">No tasks found</h3>
                      <p className="text-gray-300">Try adjusting your search criteria or filters. Tasks include both contractor employment opportunities and homeowner odd jobs.</p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Call to Action */}
      {isAuthenticated && (
        <div className="mt-12">
          <Card className="bg-gradient-to-r from-orange-500/20 to-amber-500/20 border-orange-500/50">
            <CardContent className="p-8 text-center">
              <h3 className="text-2xl font-bold text-white mb-4">Ready to get started?</h3>
              <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
                {activeTab === "find-workers" 
                  ? "Contractors: Hire helpers as employees for ongoing work. Homeowners: Find helpers for odd jobs and one-time tasks."
                  : "Apply for employment opportunities with contractors or one-time tasks from homeowners that match your skills."
                }
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button className="bg-orange-500 hover:bg-orange-600">
                  <Plus className="h-4 w-4 mr-2" />
                  {activeTab === "find-workers" ? "Post a Task" : "Apply for Task"}
                </Button>
                <Button variant="outline" className="border-gray-300 text-gray-300 hover:bg-gray-300 hover:text-navy-800">
                  {activeTab === "find-workers" ? "Join as Helper" : "Create Helper Profile"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Helper Profile Modal */}
      {selectedHelper && (
        <HelperProfileModal
          helper={{
            ...selectedHelper,
            profileImageUrl: selectedHelper.profileImageUrl || undefined,
            bio: selectedHelper.bio || undefined,
            skills: selectedHelper.skills || undefined,
            hourlyRate: selectedHelper.hourlyRate || undefined,
            averageRating: selectedHelper.averageRating || undefined,
            totalJobsCompleted: selectedHelper.totalJobsCompleted || 0,
            isIdVerified: selectedHelper.isIdVerified || false,
            isBackgroundChecked: selectedHelper.isBackgroundChecked || false,
            isAvailable: selectedHelper.isAvailable || true,
            verificationStatus: selectedHelper.verificationStatus || 'pending',
            workExperience: selectedHelper.workExperience || undefined,
            education: selectedHelper.education || undefined,
            certifications: selectedHelper.certifications || undefined,
            portfolioItems: selectedHelper.portfolioItems || undefined,
            city: undefined, // Worker type doesn't have city, using undefined
            transportationMethod: selectedHelper.transportationMethod || undefined,
            maxTravelDistance: selectedHelper.maxTravelDistance || undefined
          }}
          isOpen={isProfileModalOpen}
          onClose={() => {
            setIsProfileModalOpen(false);
            setSelectedHelper(null);
          }}
        />
      )}
    </div>
  </div>
  );
}

function HelperCard({ worker, onViewProfile }: HelperCardProps) {
  return (
    <Card 
      className="bg-navy-700 border-navy-600 hover:border-orange-500/50 transition-colors cursor-pointer" 
      onClick={onViewProfile}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center mr-3">
              <Users className="h-6 w-6 text-gray-300" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {worker.firstName} {worker.lastName}
              </h3>
              <div className="flex items-center text-sm text-gray-300">
                {worker.averageRating && (
                  <>
                    <Star className="h-4 w-4 text-yellow-500 mr-1" />
                    <span className="mr-2">{parseFloat(worker.averageRating).toFixed(1)}</span>
                  </>
                )}
                <span className="text-gray-400">•</span>
                <span className="ml-2">{worker.totalJobsCompleted} jobs completed</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            {worker.isIdVerified && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
                <Shield className="h-3 w-3 mr-1" />
                ID Verified
              </Badge>
            )}
          </div>
        </div>

        <p className="text-gray-300 text-sm mb-4 line-clamp-2">
          {worker.bio || "No bio available"}
        </p>

        <div className="flex flex-wrap gap-1 mb-4">
          {worker.skills?.slice(0, 3).map((skill) => (
            <Badge key={skill} variant="secondary" className="text-xs bg-navy-600 text-gray-300">
              {skill.replace('-', ' ')}
            </Badge>
          ))}
          {worker.skills && worker.skills.length > 3 && (
            <Badge variant="secondary" className="text-xs bg-navy-600 text-gray-300">
              +{worker.skills.length - 3} more
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center text-sm text-gray-300">
            <DollarSign className="h-4 w-4 mr-1" />
            <span>${worker.hourlyRate}/hr</span>
          </div>
          <Button 
            size="sm" 
            className="bg-orange-500 hover:bg-orange-600"
            onClick={(e) => {
              e.stopPropagation();
              // Handle contact action separately
            }}
          >
            View Profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskCard({ task }: { task: Task }) {
  const statusClass =
    task.status === 'open'
      ? 'bg-green-500/20 text-green-400 border-green-500/50'
      : task.status === 'assigned'
        ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
        : 'bg-[#0f1419]/20 text-gray-400 border-gray-500/50';

  const getPayDisplay = () => {
    if (task.payType === 'fixed') {
      return `$${task.payAmount} fixed`;
    } else if (task.payType === 'hourly') {
      return `$${task.payAmount}/hr`;
    } else {
      return `$${task.payMin} - $${task.payMax}`;
    }
  };

  return (
    <Card className="bg-navy-700 border-navy-600 hover:border-orange-500/50 transition-colors">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-2">{task.title}</h3>
            <p className="text-gray-300 text-sm mb-3 line-clamp-2">
              {task.description}
            </p>
          </div>
          <Badge className={`ml-2 ${statusClass}`}>
            {task.status?.replace('_', ' ') || 'Unknown'}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-1 mb-4">
          {task.requiredSkills?.slice(0, 3).map((skill) => (
            <Badge key={skill} variant="secondary" className="text-xs bg-navy-600 text-gray-300">
              {skill.replace('-', ' ')}
            </Badge>
          ))}
          {task.requiredSkills && task.requiredSkills.length > 3 && (
            <Badge variant="secondary" className="text-xs bg-navy-600 text-gray-300">
              +{task.requiredSkills.length - 3} more
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4 text-sm text-gray-300">
          <div className="flex items-center">
            <DollarSign className="h-4 w-4 mr-1" />
            <span>{getPayDisplay()}</span>
          </div>
          <div className="flex items-center">
            <Clock className="h-4 w-4 mr-1" />
            <span>{task.estimatedHours ? `${task.estimatedHours} hrs` : 'TBD'}</span>
          </div>
          <div className="flex items-center">
            <MapPin className="h-4 w-4 mr-1" />
            <span>{task.city || 'Remote'}</span>
          </div>
          <div className="flex items-center">
            <Shield className="h-4 w-4 mr-1" />
            <span>{task.requiresIdVerification ? 'ID Required' : 'No ID Required'}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Posted {task.createdAt ? new Date(task.createdAt).toLocaleDateString() : 'Unknown'}
          </span>
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600" disabled={task.status !== 'open'}>
            {task.status === 'open' ? 'Apply Now' : 'Not Available'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}