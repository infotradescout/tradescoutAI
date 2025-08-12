import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Star, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  Calendar,
  MapPin,
  User,
  Settings,
  Trophy,
  Briefcase,
  MessageSquare,
  Bell,
  TrendingUp,
  Award,
  Target,
  Plus
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Worker, Task, TaskApplication, WorkerReview } from "@shared/schema";

export default function HelperDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("dashboard");

  // Fetch helper profile
  const { data: helperProfile, isLoading: profileLoading } = useQuery<Worker>({
    queryKey: ['/api/workers/profile'],
    enabled: !!user && user.role === 'helper',
  });

  // Fetch available tasks
  const { data: availableTasks, isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ['/api/tasks/available'],
    enabled: activeTab === "find-work",
  });

  // Fetch helper's applications
  const { data: applications, isLoading: applicationsLoading } = useQuery<TaskApplication[]>({
    queryKey: ['/api/workers/applications'],
    enabled: activeTab === "applications",
  });

  // Fetch helper's completed jobs
  const { data: completedJobs, isLoading: jobsLoading } = useQuery<Task[]>({
    queryKey: ['/api/workers/completed-jobs'],
    enabled: activeTab === "completed-jobs",
  });

  // Fetch helper's reviews
  const { data: reviews, isLoading: reviewsLoading } = useQuery<WorkerReview[]>({
    queryKey: ['/api/workers/reviews'],
    enabled: activeTab === "reviews",
  });

  // Apply to task mutation
  const applyToTaskMutation = useMutation({
    mutationFn: async ({ taskId, application }: { taskId: string; application: any }) => {
      return apiRequest("POST", `/api/tasks/${taskId}/apply`, application);
    },
    onSuccess: () => {
      toast({ title: "Application submitted successfully!" });
      queryClient.invalidateQueries({ queryKey: ['/api/workers/applications'] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to submit application", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleApplyToTask = (taskId: string) => {
    // For now, submit a basic application - in the future this could open a detailed modal
    applyToTaskMutation.mutate({
      taskId,
      application: {
        message: "I'm interested in this task and available to start immediately.",
        proposedRate: null, // Will use task's posted rate
        availableStartDate: new Date().toISOString(),
      }
    });
  };

  const getTaskStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-green-500">Open</Badge>;
      case 'assigned':
        return <Badge className="bg-blue-500">Assigned</Badge>;
      case 'in_progress':
        return <Badge className="bg-yellow-500">In Progress</Badge>;
      case 'completed':
        return <Badge className="bg-purple-500">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="border-red-500 text-red-500">Cancelled</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getApplicationStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500">Pending</Badge>;
      case 'accepted':
        return <Badge className="bg-green-500">Accepted</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="border-red-500 text-red-500">Rejected</Badge>;
      case 'withdrawn':
        return <Badge variant="outline">Withdrawn</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const renderStarRating = (rating: number) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating 
                ? 'fill-yellow-400 text-yellow-400' 
                : 'text-gray-300'
            }`}
          />
        ))}
        <span className="ml-2 text-sm text-gray-600">{rating.toFixed(1)}</span>
      </div>
    );
  };

  // Dashboard overview stats
  const stats = {
    averageRating: helperProfile?.averageRating ? parseFloat(helperProfile.averageRating) : 0,
    totalJobs: helperProfile?.totalJobsCompleted || 0,
    totalEarnings: helperProfile?.totalEarnings ? parseFloat(helperProfile.totalEarnings) : 0,
    pendingApplications: applications?.filter(app => app.status === 'pending').length || 0,
    activeJobs: applications?.filter(app => app.status === 'accepted').length || 0,
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading your helper dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome back, {helperProfile?.firstName || user?.firstName}!
          </h1>
          <p className="text-gray-300">
            Manage your helper profile, find new opportunities, and track your earnings.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card className="bg-navy-800/50 border-navy-600">
            <CardContent className="p-6">
              <div className="flex items-center">
                <Star className="h-8 w-8 text-yellow-400" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-300">Average Rating</p>
                  <p className="text-2xl font-bold text-white">
                    {stats.averageRating.toFixed(1)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600">
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-400" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-300">Jobs Completed</p>
                  <p className="text-2xl font-bold text-white">{stats.totalJobs}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600">
            <CardContent className="p-6">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-green-400" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-300">Total Earnings</p>
                  <p className="text-2xl font-bold text-white">
                    ${stats.totalEarnings.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600">
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-yellow-400" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-300">Pending Apps</p>
                  <p className="text-2xl font-bold text-white">{stats.pendingApplications}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600">
            <CardContent className="p-6">
              <div className="flex items-center">
                <Briefcase className="h-8 w-8 text-blue-400" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-300">Active Jobs</p>
                  <p className="text-2xl font-bold text-white">{stats.activeJobs}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 lg:grid-cols-6">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="find-work">Find Work</TabsTrigger>
            <TabsTrigger value="applications">Applications</TabsTrigger>
            <TabsTrigger value="completed-jobs">Completed</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activity */}
              <Card className="bg-navy-800/50 border-navy-600">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <TrendingUp className="h-5 w-5 mr-2" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-2 border-b border-navy-600">
                      <div>
                        <p className="text-white font-medium">Application submitted</p>
                        <p className="text-sm text-gray-400">House cleaning task</p>
                      </div>
                      <span className="text-sm text-gray-400">2 hours ago</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-navy-600">
                      <div>
                        <p className="text-white font-medium">Job completed</p>
                        <p className="text-sm text-gray-400">Furniture assembly</p>
                      </div>
                      <span className="text-sm text-gray-400">1 day ago</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-white font-medium">New review received</p>
                        <p className="text-sm text-gray-400">5 stars - Garden cleanup</p>
                      </div>
                      <span className="text-sm text-gray-400">3 days ago</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Profile Completion */}
              <Card className="bg-navy-800/50 border-navy-600">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <Target className="h-5 w-5 mr-2" />
                    Profile Completion
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-300">Overall Progress</span>
                        <span className="text-white">75%</span>
                      </div>
                      <Progress value={75} className="h-2" />
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center text-green-400">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Basic information completed
                      </div>
                      <div className="flex items-center text-green-400">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Skills and experience added
                      </div>
                      <div className="flex items-center text-yellow-400">
                        <Clock className="h-4 w-4 mr-2" />
                        Upload profile photo
                      </div>
                      <div className="flex items-center text-yellow-400">
                        <Clock className="h-4 w-4 mr-2" />
                        Complete ID verification
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="find-work" className="space-y-6">
            <Card className="bg-navy-800/50 border-navy-600">
              <CardHeader>
                <CardTitle className="text-white">Available Opportunities</CardTitle>
              </CardHeader>
              <CardContent>
                {tasksLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
                    <p className="text-gray-300">Loading available tasks...</p>
                  </div>
                ) : availableTasks && availableTasks.length > 0 ? (
                  <div className="space-y-4">
                    {availableTasks.map((task) => (
                      <div key={task.id} className="bg-navy-700/50 rounded-lg p-4 border border-navy-600">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <h3 className="text-white font-semibold text-lg">{task.title}</h3>
                            <p className="text-gray-300 mt-1">{task.description}</p>
                          </div>
                          {getTaskStatusBadge(task.status)}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                          <div className="flex items-center text-gray-300">
                            <DollarSign className="h-4 w-4 mr-2" />
                            <span>${task.payAmount} {task.payType}</span>
                          </div>
                          <div className="flex items-center text-gray-300">
                            <MapPin className="h-4 w-4 mr-2" />
                            <span>{task.city}, {task.stateCode}</span>
                          </div>
                          <div className="flex items-center text-gray-300">
                            <Calendar className="h-4 w-4 mr-2" />
                            <span>{task.schedulingType}</span>
                          </div>
                        </div>

                        {task.requiredSkills && task.requiredSkills.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm text-gray-400 mb-2">Required Skills:</p>
                            <div className="flex flex-wrap gap-2">
                              {task.requiredSkills.map((skill, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between items-center mt-4">
                          <span className="text-sm text-gray-400">
                            Posted {new Date(task.createdAt).toLocaleDateString()}
                          </span>
                          <Button 
                            onClick={() => handleApplyToTask(task.id)}
                            disabled={applyToTaskMutation.isPending}
                            className="bg-orange-600 hover:bg-orange-700"
                          >
                            {applyToTaskMutation.isPending ? 'Applying...' : 'Apply Now'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">No tasks available</h3>
                    <p className="text-gray-400">Check back soon for new opportunities in your area.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="applications" className="space-y-6">
            <Card className="bg-navy-800/50 border-navy-600">
              <CardHeader>
                <CardTitle className="text-white">Your Applications</CardTitle>
              </CardHeader>
              <CardContent>
                {applicationsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
                    <p className="text-gray-300">Loading applications...</p>
                  </div>
                ) : applications && applications.length > 0 ? (
                  <div className="space-y-4">
                    {applications.map((application) => (
                      <div key={application.id} className="bg-navy-700/50 rounded-lg p-4 border border-navy-600">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <h3 className="text-white font-semibold">Task Application</h3>
                            <p className="text-gray-300 mt-1">{application.message}</p>
                          </div>
                          {getApplicationStatusBadge(application.status)}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                          {application.proposedRate && (
                            <div className="flex items-center text-gray-300">
                              <DollarSign className="h-4 w-4 mr-2" />
                              <span>Proposed Rate: ${application.proposedRate}</span>
                            </div>
                          )}
                          <div className="flex items-center text-gray-300">
                            <Calendar className="h-4 w-4 mr-2" />
                            <span>Applied {new Date(application.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">No applications yet</h3>
                    <p className="text-gray-400">Apply to tasks to start building your work history.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="completed-jobs" className="space-y-6">
            <Card className="bg-navy-800/50 border-navy-600">
              <CardHeader>
                <CardTitle className="text-white">Completed Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                {jobsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
                    <p className="text-gray-300">Loading completed jobs...</p>
                  </div>
                ) : completedJobs && completedJobs.length > 0 ? (
                  <div className="space-y-4">
                    {completedJobs.map((job) => (
                      <div key={job.id} className="bg-navy-700/50 rounded-lg p-4 border border-navy-600">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <h3 className="text-white font-semibold">{job.title}</h3>
                            <p className="text-gray-300 mt-1">{job.description}</p>
                          </div>
                          <Badge className="bg-green-500">Completed</Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                          <div className="flex items-center text-gray-300">
                            <DollarSign className="h-4 w-4 mr-2" />
                            <span>${job.payAmount}</span>
                          </div>
                          <div className="flex items-center text-gray-300">
                            <MapPin className="h-4 w-4 mr-2" />
                            <span>{job.city}, {job.stateCode}</span>
                          </div>
                          <div className="flex items-center text-gray-300">
                            <CheckCircle className="h-4 w-4 mr-2" />
                            <span>Completed {job.completedAt ? new Date(job.completedAt).toLocaleDateString() : 'Recently'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">No completed jobs yet</h3>
                    <p className="text-gray-400">Complete your first task to start building your reputation.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reviews" className="space-y-6">
            <Card className="bg-navy-800/50 border-navy-600">
              <CardHeader>
                <CardTitle className="text-white">Client Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                {reviewsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
                    <p className="text-gray-300">Loading reviews...</p>
                  </div>
                ) : reviews && reviews.length > 0 ? (
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <div key={review.id} className="bg-navy-700/50 rounded-lg p-4 border border-navy-600">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            {renderStarRating(review.rating)}
                            <p className="text-gray-300 mt-2">{review.reviewText}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                          {review.qualityRating && (
                            <div className="text-gray-300">
                              <span className="text-gray-400">Quality:</span> {review.qualityRating}/5
                            </div>
                          )}
                          {review.timelinessRating && (
                            <div className="text-gray-300">
                              <span className="text-gray-400">Timeliness:</span> {review.timelinessRating}/5
                            </div>
                          )}
                          {review.communicationRating && (
                            <div className="text-gray-300">
                              <span className="text-gray-400">Communication:</span> {review.communicationRating}/5
                            </div>
                          )}
                          {review.professionalismRating && (
                            <div className="text-gray-300">
                              <span className="text-gray-400">Professionalism:</span> {review.professionalismRating}/5
                            </div>
                          )}
                        </div>

                        <div className="flex justify-between items-center mt-4">
                          <span className="text-sm text-gray-400">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </span>
                          {review.wouldHireAgain && (
                            <Badge className="bg-green-500">Would hire again</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Star className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">No reviews yet</h3>
                    <p className="text-gray-400">Complete jobs to start receiving reviews from clients.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="space-y-6">
            <Card className="bg-navy-800/50 border-navy-600">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Helper Profile Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">Profile Settings</h3>
                  <p className="text-gray-400 mb-4">Manage your helper profile, skills, and availability.</p>
                  <Button className="bg-orange-600 hover:bg-orange-700">
                    Edit Profile
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}