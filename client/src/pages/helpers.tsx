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
  Filter,
  Wrench,
  Calendar
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { HelperProfileModal } from "@/components/HelperProfileModal";
import type { Worker, Task, TaskCategory } from "@shared/schema";

export default function Helpers() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("find-helpers");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [sortBy, setSortBy] = useState("rating");
  const [selectedHelper, setSelectedHelper] = useState<Worker | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [posterType, setPosterType] = useState<'contractor' | 'homeowner'>('homeowner');

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
    enabled: activeTab === "find-helpers",
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

  const handleViewProfile = (helper: Worker) => {
    setSelectedHelper(helper);
    setIsProfileModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <Badge className="bg-green-500">Available</Badge>;
      case 'busy':
        return <Badge className="bg-yellow-500">Busy</Badge>;
      case 'offline':
        return <Badge variant="outline" className="border-gray-500 text-gray-500">Offline</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'urgent':
        return <Badge className="bg-red-500">Urgent</Badge>;
      case 'soon':
        return <Badge className="bg-orange-500">Soon</Badge>;
      case 'flexible':
        return <Badge className="bg-blue-500">Flexible</Badge>;
      default:
        return <Badge variant="outline">Standard</Badge>;
    }
  };

  return (
    <div className="min-h-screen gradient-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Find Skilled Helpers
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-6">
            Connect with verified helpers for your projects. Contractors can hire workers for job assistance, 
            and homeowners can find helpers for odd jobs and tasks around the house.
          </p>
          
          {/* Poster Type Selection */}
          <div className="flex justify-center mb-8">
            <div className="bg-navy-800/50 rounded-lg p-1 border border-navy-600">
              <button
                onClick={() => setPosterType('homeowner')}
                className={`px-6 py-2 rounded-md font-medium transition-colors ${
                  posterType === 'homeowner'
                    ? 'bg-orange-600 text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                I'm a Homeowner
              </button>
              <button
                onClick={() => setPosterType('contractor')}
                className={`px-6 py-2 rounded-md font-medium transition-colors ${
                  posterType === 'contractor'
                    ? 'bg-orange-600 text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                I'm a Contractor
              </button>
            </div>
          </div>

          {/* Dynamic Description Based on Poster Type */}
          <div className="bg-navy-800/30 rounded-lg p-6 max-w-4xl mx-auto border border-navy-600">
            {posterType === 'homeowner' ? (
              <div>
                <h2 className="text-2xl font-bold text-white mb-3">For Homeowners</h2>
                <p className="text-gray-300 text-lg">
                  Need help with household tasks, repairs, cleaning, or organizing? Find skilled helpers in your area 
                  who can assist with everything from furniture assembly to yard work, moving, and seasonal tasks.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <div className="text-center">
                    <Wrench className="h-8 w-8 text-orange-400 mx-auto mb-2" />
                    <h3 className="font-semibold text-white">Basic Repairs</h3>
                    <p className="text-sm text-gray-400">Handyman tasks, furniture assembly, simple fixes</p>
                  </div>
                  <div className="text-center">
                    <Users className="h-8 w-8 text-orange-400 mx-auto mb-2" />
                    <h3 className="font-semibold text-white">General Labor</h3>
                    <p className="text-sm text-gray-400">Moving, lifting, organizing, cleaning tasks</p>
                  </div>
                  <div className="text-center">
                    <Calendar className="h-8 w-8 text-orange-400 mx-auto mb-2" />
                    <h3 className="font-semibold text-white">Flexible Scheduling</h3>
                    <p className="text-sm text-gray-400">One-time tasks, recurring help, project-based work</p>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-2xl font-bold text-white mb-3">For Contractors</h2>
                <p className="text-gray-300 text-lg">
                  Expand your team capacity with skilled workers who can assist with job sites, provide specialized 
                  labor, or help with overflow work. Find reliable helpers to support your contracting business.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <div className="text-center">
                    <Briefcase className="h-8 w-8 text-orange-400 mx-auto mb-2" />
                    <h3 className="font-semibold text-white">Job Site Support</h3>
                    <p className="text-sm text-gray-400">Additional hands for construction and installation work</p>
                  </div>
                  <div className="text-center">
                    <Users className="h-8 w-8 text-orange-400 mx-auto mb-2" />
                    <h3 className="font-semibold text-white">Skilled Labor</h3>
                    <p className="text-sm text-gray-400">Experienced workers with specialized trade skills</p>
                  </div>
                  <div className="text-center">
                    <Clock className="h-8 w-8 text-orange-400 mx-auto mb-2" />
                    <h3 className="font-semibold text-white">Flexible Workforce</h3>
                    <p className="text-sm text-gray-400">Scale your team up or down based on project needs</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 bg-navy-800/50 border-navy-600">
          <TabsTrigger value="find-helpers" className="text-gray-300 data-[state=active]:text-white data-[state=active]:bg-orange-600">
            Find Helpers
          </TabsTrigger>
          <TabsTrigger value="find-tasks" className="text-gray-300 data-[state=active]:text-white data-[state=active]:bg-orange-600">
            {posterType === 'contractor' ? 'Find Workers' : 'Find Tasks'}
          </TabsTrigger>
          <TabsTrigger value="post-task" className="text-gray-300 data-[state=active]:text-white data-[state=active]:bg-orange-600">
            {posterType === 'contractor' ? 'Post Job' : 'Post Task'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="find-helpers" className="space-y-6">
          {/* Search and Filters */}
          <Card className="bg-[#1a2332] border-slate-700">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search helpers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a2332] border-slate-700">
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories?.map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Location"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white"
                />

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a2332] border-slate-700">
                    <SelectItem value="rating">Highest Rated</SelectItem>
                    <SelectItem value="experience">Most Experienced</SelectItem>
                    <SelectItem value="price">Lowest Price</SelectItem>
                    <SelectItem value="availability">Available Now</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Helpers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workersLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="bg-[#1a2332] border-slate-700 animate-pulse">
                  <CardContent className="p-6">
                    <div className="flex items-center mb-4">
                      <div className="w-16 h-16 bg-slate-600 rounded-full mr-4"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-slate-600 rounded mb-2"></div>
                        <div className="h-3 bg-slate-600 rounded w-2/3"></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 bg-slate-600 rounded"></div>
                      <div className="h-3 bg-slate-600 rounded w-4/5"></div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : filteredWorkers?.length > 0 ? (
              filteredWorkers.map((worker) => (
                <Card key={worker.id} className="bg-[#1a2332] border-slate-700 hover:border-orange-500/50 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center">
                        <div className="w-16 h-16 bg-slate-600 rounded-full flex items-center justify-center mr-4">
                          <Users className="h-8 w-8 text-slate-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">{worker.firstName} {worker.lastName}</h3>
                          <div className="flex items-center mt-1">
                            <Star className="h-4 w-4 text-yellow-500 mr-1" />
                            <span className="text-sm text-gray-300">{worker.averageRating || '5.0'}</span>
                            <span className="text-sm text-gray-500 ml-1">({worker.totalJobsCompleted} jobs)</span>
                          </div>
                        </div>
                      </div>
                      {getStatusBadge(worker.isAvailable ? 'available' : 'offline')}
                    </div>

                    <p className="text-gray-300 text-sm mb-4 line-clamp-2">{worker.bio}</p>

                    <div className="flex flex-wrap gap-1 mb-4">
                      {worker.skills?.slice(0, 3).map((skill, index) => (
                        <Badge key={index} variant="outline" className="border-orange-500/50 text-orange-400 text-xs">
                          {skill}
                        </Badge>
                      ))}
                      {worker.skills && worker.skills.length > 3 && (
                        <Badge variant="outline" className="border-slate-600 text-slate-400 text-xs">
                          +{worker.skills.length - 3} more
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center text-sm text-gray-400">
                        <MapPin className="h-4 w-4 mr-1" />
                        'Location not specified'
                      </div>
                      <div className="flex items-center text-sm text-gray-400">
                        <DollarSign className="h-4 w-4 mr-1" />
                        {worker.hourlyRate || '$25'}/hr
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {worker.isIdVerified && (
                          <div className="flex items-center">
                            <Shield className="h-4 w-4 text-green-500 mr-1" />
                            <span className="text-xs text-green-400">ID Verified</span>
                          </div>
                        )}
                        {worker.isBackgroundChecked && (
                          <div className="flex items-center">
                            <CheckCircle className="h-4 w-4 text-blue-500 mr-1" />
                            <span className="text-xs text-blue-400">Background Check</span>
                          </div>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewProfile(worker)}
                          className="border-slate-600 text-slate-300 hover:bg-slate-700"
                        >
                          View Profile
                        </Button>
                        <Button size="sm" className="bg-orange-500 hover:bg-orange-600">
                          Contact
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-3 text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400">No helpers found matching your criteria.</p>
                <Button className="mt-4 bg-orange-500 hover:bg-orange-600">
                  <Plus className="h-4 w-4 mr-2" />
                  Post a Task Instead
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="find-tasks" className="space-y-6">
          {/* Tasks Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tasksLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="bg-[#1a2332] border-slate-700 animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-6 bg-slate-600 rounded mb-4"></div>
                    <div className="h-4 bg-slate-600 rounded mb-2"></div>
                    <div className="h-4 bg-slate-600 rounded w-3/4 mb-4"></div>
                    <div className="flex justify-between">
                      <div className="h-4 bg-slate-600 rounded w-1/4"></div>
                      <div className="h-4 bg-slate-600 rounded w-1/4"></div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : filteredTasks?.length > 0 ? (
              filteredTasks.map((task) => (
                <Card key={task.id} className="bg-[#1a2332] border-slate-700 hover:border-orange-500/50 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="font-semibold text-white text-lg">{task.title}</h3>
                      {getUrgencyBadge('standard')}
                    </div>

                    <p className="text-gray-300 mb-4 line-clamp-3">{task.description}</p>

                    <div className="flex flex-wrap gap-1 mb-4">
                      {task.requiredSkills?.slice(0, 4).map((skill, index) => (
                        <Badge key={index} variant="outline" className="border-orange-500/50 text-orange-400 text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center text-sm text-gray-400">
                        <MapPin className="h-4 w-4 mr-1" />
                        {task.address || 'Location TBD'}
                      </div>
                      <div className="flex items-center text-sm text-gray-400">
                        <Clock className="h-4 w-4 mr-1" />
                        {task.estimatedHours || 'TBD'} hours
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <DollarSign className="h-5 w-5 text-green-500 mr-1" />
                        <span className="text-lg font-semibold text-green-400">${task.payAmount || 'TBD'}</span>
                      </div>
                      <Button className="bg-orange-500 hover:bg-orange-600">
                        Apply for Task
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-2 text-center py-12">
                <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400">No tasks available at the moment.</p>
                <p className="text-sm text-gray-500 mt-2">Check back later or post your own task.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="post-task" className="space-y-6">
          <Card className="bg-[#1a2332] border-slate-700">
            <CardHeader>
              <h2 className="text-xl font-semibold text-white">Post a New Task</h2>
              <p className="text-gray-400">Describe your task and find the right helper</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Task Title</label>
                    <Input 
                      placeholder="e.g., Help move furniture" 
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Category</label>
                    <Select>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a2332] border-slate-700">
                        {categories?.map(category => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Budget</label>
                    <Input 
                      type="number" 
                      placeholder="Enter your budget" 
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Location</label>
                    <Input 
                      placeholder="City, State" 
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Description</label>
                    <textarea 
                      className="w-full h-32 p-3 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400"
                      placeholder="Describe your task in detail..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Required Skills</label>
                    <Input 
                      placeholder="e.g., physical strength, furniture handling" 
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Urgency</label>
                    <Select>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="When do you need this done?" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a2332] border-slate-700">
                        <SelectItem value="urgent">Urgent (Within 24 hours)</SelectItem>
                        <SelectItem value="soon">Soon (Within a week)</SelectItem>
                        <SelectItem value="flexible">Flexible (Within a month)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                  Save Draft
                </Button>
                <Button className="bg-orange-500 hover:bg-orange-600">
                  Post Task
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="find-tasks" className="space-y-6">
          {/* Search and Filters for Tasks */}
          <Card className="bg-navy-800/50 border-navy-600">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder={posterType === 'contractor' ? 'Search jobs...' : 'Search tasks...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-navy-700 border-navy-600 text-white"
                  />
                </div>
                
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent className="bg-navy-800 border-navy-700">
                    <SelectItem value="all">All Categories</SelectItem>
                    {posterType === 'contractor' ? (
                      <>
                        <SelectItem value="construction">Construction</SelectItem>
                        <SelectItem value="electrical">Electrical</SelectItem>
                        <SelectItem value="plumbing">Plumbing</SelectItem>
                        <SelectItem value="roofing">Roofing</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="cleaning">Cleaning</SelectItem>
                        <SelectItem value="moving">Moving</SelectItem>
                        <SelectItem value="assembly">Assembly</SelectItem>
                        <SelectItem value="yard-work">Yard Work</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Location"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="bg-navy-700 border-navy-600 text-white"
                />

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent className="bg-navy-800 border-navy-700">
                    <SelectItem value="pay">Highest Pay</SelectItem>
                    <SelectItem value="recent">Most Recent</SelectItem>
                    <SelectItem value="urgent">Most Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Available Tasks Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTasks?.length > 0 ? (
              filteredTasks.map((task) => (
                <Card key={task.id} className="bg-navy-800/50 border-navy-600 hover:border-orange-500/50 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-white mb-1">{task.title}</h3>
                        <div className="flex items-center text-sm text-gray-400">
                          <MapPin className="h-4 w-4 mr-1" />
                          {task.city}, {task.stateCode}
                        </div>
                      </div>
                      {getUrgencyBadge(task.urgency || 'standard')}
                    </div>

                    <p className="text-gray-300 text-sm mb-4 line-clamp-3">{task.description}</p>

                    <div className="flex flex-wrap gap-1 mb-4">
                      {task.requiredSkills?.slice(0, 3).map((skill, index) => (
                        <Badge key={index} variant="outline" className="border-orange-500/50 text-orange-400 text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center text-sm text-gray-400">
                        <DollarSign className="h-4 w-4 mr-1" />
                        {task.payType === 'hourly' ? `$${task.payAmount}/hr` : `$${task.payAmount}`}
                      </div>
                      <div className="flex items-center text-sm text-gray-400">
                        <Clock className="h-4 w-4 mr-1" />
                        {task.schedulingType === 'asap' ? 'ASAP' : 'Flexible'}
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline" className="flex-1 border-navy-600 text-gray-300 hover:bg-navy-700">
                        View Details
                      </Button>
                      <Button size="sm" className="bg-orange-500 hover:bg-orange-600">
                        Apply
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <Users className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">
                  {posterType === 'contractor' ? 'No jobs available' : 'No tasks available'}
                </h3>
                <p className="text-gray-400">
                  {posterType === 'contractor' 
                    ? 'Check back later for new construction job opportunities.'
                    : 'Check back later for new tasks to complete.'
                  }
                </p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
      </div>

      {/* Helper Profile Modal */}
      {selectedHelper && (
        <HelperProfileModal
          helper={{
            id: selectedHelper.id,
            firstName: selectedHelper.firstName,
            lastName: selectedHelper.lastName,
            profileImageUrl: selectedHelper.profileImageUrl || undefined,
            bio: selectedHelper.bio || undefined,
            skills: selectedHelper.skills || undefined,
            hourlyRate: selectedHelper.hourlyRate || undefined,
            averageRating: selectedHelper.averageRating || undefined,
            totalJobsCompleted: selectedHelper.totalJobsCompleted || 0,
            isIdVerified: selectedHelper.isIdVerified || false,
            isBackgroundChecked: selectedHelper.isBackgroundChecked || false,
            verificationStatus: selectedHelper.verificationStatus || 'unverified',
            city: undefined,
            transportationMethod: selectedHelper.transportationMethod || undefined,
            maxTravelDistance: selectedHelper.maxTravelDistance || undefined,
            isAvailable: selectedHelper.isAvailable || false,
          }}
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
        />
      )}
    </div>
  );
}