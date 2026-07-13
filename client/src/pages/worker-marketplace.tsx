import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, MapPin, Clock, DollarSign, Shield, Users, Briefcase, Plus } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { HelperProfileModal } from "@/components/HelperProfileModal";
import { WorkerMarketplaceShell } from "@/shells/WorkerMarketplaceShell";
import type { Worker, Task, TaskCategory } from "@shared/schema";

type HelperCardProps = {
  worker: Worker;
  onViewProfile: () => void;
};

export default function WorkerMarketplace() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("find-workers");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [sortBy, setSortBy] = useState("jobs-completed");
  const [selectedHelper, setSelectedHelper] = useState<Worker | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const [isPostTaskOpen, setIsPostTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskCategoryId, setTaskCategoryId] = useState<string>("");
  const [taskPayType, setTaskPayType] = useState<"fixed" | "hourly" | "per_task">("fixed");
  const [taskPayAmount, setTaskPayAmount] = useState<string>("");
  const [taskTaskType, setTaskTaskType] = useState<"one_time" | "recurring" | "project_based">(
    "one_time"
  );
  const [taskSchedulingType, setTaskSchedulingType] = useState<"asap" | "scheduled" | "flexible">(
    "asap"
  );
  const [taskCity, setTaskCity] = useState<string>("");
  const [taskStateCode, setTaskStateCode] = useState<string>("");

  const [applyTask, setApplyTask] = useState<Task | null>(null);
  const [applyMessage, setApplyMessage] = useState("");
  const fieldClass = "border-white/10 bg-black/30 text-white placeholder:text-white/60";

  // Fetch workers
  const { data: workers, isLoading: workersLoading } = useQuery<Worker[]>({
    queryKey: ["/api/workers", selectedCategory, locationFilter, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory) params.append("category", selectedCategory);
      if (locationFilter) params.append("location", locationFilter);
      if (sortBy) params.append("sort", sortBy);

      const response = await fetch(`/api/workers?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch workers");
      return response.json();
    },
    enabled: activeTab === "find-workers",
  });

  // Fetch tasks
  const { data: tasks, isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks", selectedCategory, locationFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory) params.append("category", selectedCategory);
      if (locationFilter) params.append("location", locationFilter);

      const response = await fetch(`/api/tasks?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch tasks");
      return response.json();
    },
    enabled: activeTab === "find-tasks",
  });

  // Fetch task categories
  const { data: categories } = useQuery<TaskCategory[]>({
    queryKey: ["/api/task-categories"],
  });

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const payAmount = Number(taskPayAmount);
      if (!taskTitle.trim()) throw new Error("Title is required");
      if (!taskDescription.trim()) throw new Error("Description is required");
      if (!Number.isFinite(payAmount) || payAmount <= 0)
        throw new Error("Pay amount must be a positive number");

      return apiRequest("POST", "/api/tasks", {
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        categoryId: taskCategoryId || undefined,
        payType: taskPayType,
        payAmount,
        taskType: taskTaskType,
        schedulingType: taskSchedulingType,
        city: taskCity.trim() || undefined,
        stateCode: taskStateCode.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: "Task posted", description: "Your task is now visible to helpers." });
      setIsPostTaskOpen(false);
      setTaskTitle("");
      setTaskDescription("");
      setTaskCategoryId("");
      setTaskPayAmount("");
      setTaskCity("");
      setTaskStateCode("");
      setActiveTab("find-tasks");
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't post task",
        description: formatUserFacingErrorMessage(err, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const applyToTaskMutation = useMutation({
    mutationFn: async ({ taskId, message }: { taskId: string; message?: string }) => {
      return apiRequest("POST", `/api/tasks/${taskId}/apply`, { message });
    },
    onSuccess: () => {
      toast({ title: "Application sent", description: "The task poster will be notified." });
      setApplyTask(null);
      setApplyMessage("");
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't apply",
        description: formatUserFacingErrorMessage(err, "Please try again."),
        variant: "destructive",
      });
    },
  });

  // Filter workers based on search
  const filteredWorkers = useMemo(() => {
    if (!workers) return [];

    return workers.filter((worker) => {
      const matchesSearch =
        !searchQuery ||
        `${worker.firstName} ${worker.lastName}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        worker.bio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        worker.skills?.some((skill) => skill.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesSearch;
    });
  }, [workers, searchQuery]);

  // Filter tasks based on search
  const filteredTasks = useMemo(() => {
    if (!tasks) return [];

    return tasks.filter((task) => {
      const matchesSearch =
        !searchQuery ||
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.requiredSkills?.some((skill) =>
          skill.toLowerCase().includes(searchQuery.toLowerCase())
        );

      return matchesSearch;
    });
  }, [tasks, searchQuery]);

  return (
    <WorkerMarketplaceShell>
      {/* Header - Helpers tab under Direct Connect */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">Helpers - Direct Connect Responders</h1>
        <p className="max-w-3xl text-base text-white/60 md:text-lg">
          Match local helpers to short-term work and crew support. Homeowner project requests still
          start in Direct Connect.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/direct-connect">
            <Button className="bg-ts-orange text-text-black hover:bg-ts-orange/90">
              Go to Direct Connect
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
        <TabsList className="grid w-full grid-cols-2 border border-white/10 bg-black/35 p-1">
          <TabsTrigger
            value="find-workers"
            className="text-white/60 data-[state=active]:bg-ts-orange/20 data-[state=active]:text-white"
          >
            <Users className="h-4 w-4 mr-2" />
            Find providers
          </TabsTrigger>
          <TabsTrigger
            value="find-tasks"
            className="text-white/60 data-[state=active]:bg-ts-orange/20 data-[state=active]:text-white"
          >
            <Briefcase className="h-4 w-4 mr-2" />
            Find work
          </TabsTrigger>
        </TabsList>

        {/* Search and Filters */}
        <div className="mb-6 mt-6 rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
              <Input
                placeholder={
                  activeTab === "find-workers" ? "Search providers..." : "Search work..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-10 ${fieldClass}`}
              />
            </div>

            <Select
              value={selectedCategory || "all"}
              onValueChange={(value) => setSelectedCategory(value === "all" ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
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
              className={fieldClass}
            />

            {activeTab === "find-workers" && (
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="jobs-completed">Most Jobs Completed</SelectItem>
                  <SelectItem value="newest">Newest Members</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Find Providers Tab */}
        <TabsContent value="find-workers">
          {workersLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="border-white/10 bg-tsCard/90 animate-pulse">
                  <CardContent className="p-6">
                    <div className="mb-4 h-4 rounded bg-black/30"></div>
                    <div className="mb-4 h-16 rounded bg-black/30"></div>
                    <div className="h-4 rounded bg-black/30"></div>
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
                  <Card className="border-white/10 bg-tsCard/90">
                    <CardContent className="p-8 text-center">
                      <Users className="h-12 w-12 text-white/60 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-white mb-2">No helpers found</h3>
                      <p className="text-white/60">Try another search or filter.</p>
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
                <Card key={i} className="border-white/10 bg-tsCard/90 animate-pulse">
                  <CardContent className="p-6">
                    <div className="mb-4 h-4 rounded bg-black/30"></div>
                    <div className="mb-4 h-20 rounded bg-black/30"></div>
                    <div className="h-4 rounded bg-black/30"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onApply={() => {
                    setApplyTask(task);
                    setApplyMessage("");
                  }}
                />
              ))}
              {filteredTasks.length === 0 && (
                <div className="col-span-full">
                  <Card className="border-white/10 bg-tsCard/90">
                    <CardContent className="p-8 text-center">
                      <Briefcase className="h-12 w-12 text-white/60 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-white mb-2">No tasks found</h3>
                      <p className="text-white/60">Try another search or filter.</p>
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
          <Card className="border-white/10 bg-tsCard/95 shadow-[0_12px_34px_rgba(0,0,0,0.35)]">
            <CardContent className="p-8 text-center">
              <h3 className="text-2xl font-bold text-white mb-4">Ready to get started?</h3>
              <p className="mx-auto mb-6 max-w-2xl text-white/60">
                {activeTab === "find-workers"
                  ? "Need a helper? Post a scoped request."
                  : "Apply to jobs that match your skills."}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  className="bg-ts-orange text-text-black hover:bg-ts-orange/90"
                  onClick={() => setIsPostTaskOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Direct Connect request
                </Button>
                <Button
                  variant="outline"
                  className="border-white/10 text-white hover:bg-black/30"
                  onClick={() => {
                    // Route helpers into Direct Connect flows instead of a separate Helpers hub
                    window.location.href = "/direct-connect";
                  }}
                >
                  {activeTab === "find-workers" ? "Join as Helper" : "Create Helper Profile"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Helper Profile Modal */}
      <Dialog open={isPostTaskOpen} onOpenChange={setIsPostTaskOpen}>
        <DialogContent className="border-white/10 bg-tsCard/95 text-white">
          <DialogHeader>
            <DialogTitle>Create Direct Connect request</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className={fieldClass}
                placeholder="e.g., Help moving a couch"
              />
            </div>

            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                className={fieldClass}
                placeholder="What needs to be done, when, and any requirements"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select
                  value={taskCategoryId || "none"}
                  onValueChange={(v) => setTaskCategoryId(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category</SelectItem>
                    {categories?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Task type</Label>
                <Select value={taskTaskType} onValueChange={(v) => setTaskTaskType(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">One-time</SelectItem>
                    <SelectItem value="recurring">Recurring</SelectItem>
                    <SelectItem value="project_based">Project-based</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Pay type</Label>
                <Select value={taskPayType} onValueChange={(v) => setTaskPayType(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="per_task">Per task</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Pay amount</Label>
                <Input
                  value={taskPayAmount}
                  onChange={(e) => setTaskPayAmount(e.target.value)}
                  className={fieldClass}
                  placeholder="e.g., 150"
                  inputMode="decimal"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Scheduling</Label>
                <Select
                  value={taskSchedulingType}
                  onValueChange={(v) => setTaskSchedulingType(v as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asap">ASAP</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="flexible">Flexible</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>City (optional)</Label>
                <Input
                  value={taskCity}
                  onChange={(e) => setTaskCity(e.target.value)}
                  className={fieldClass}
                  placeholder="e.g., Austin"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>State (optional)</Label>
                <Input
                  value={taskStateCode}
                  onChange={(e) => setTaskStateCode(e.target.value)}
                  className={fieldClass}
                  placeholder="e.g., TX"
                  maxLength={2}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                className="border-white/10 text-white hover:bg-black/30"
                onClick={() => setIsPostTaskOpen(false)}
                disabled={createTaskMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                className="bg-ts-orange text-text-black hover:bg-ts-orange/90"
                onClick={() => createTaskMutation.mutate()}
                disabled={createTaskMutation.isPending}
              >
                {createTaskMutation.isPending ? "Posting..." : "Post helper opportunity"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(applyTask)} onOpenChange={(open) => !open && setApplyTask(null)}>
        <DialogContent className="border-white/10 bg-tsCard/95 text-white">
          <DialogHeader>
            <DialogTitle>Apply to task</DialogTitle>
          </DialogHeader>

          {applyTask && (
            <div className="grid gap-4">
              <div className="text-sm text-white/60">
                <div className="font-semibold text-white">{applyTask.title}</div>
                <div className="mt-1">{applyTask.description}</div>
              </div>

              <div className="grid gap-2">
                <Label>Message (optional)</Label>
                <Textarea
                  value={applyMessage}
                  onChange={(e) => setApplyMessage(e.target.value)}
                  className={fieldClass}
                  placeholder="Tell them why you're a good fit"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  className="border-white/10 text-white hover:bg-black/30"
                  onClick={() => setApplyTask(null)}
                  disabled={applyToTaskMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-ts-orange text-text-black hover:bg-ts-orange/90"
                  onClick={() =>
                    applyToTaskMutation.mutate({
                      taskId: applyTask.id,
                      message: applyMessage.trim() || undefined,
                    })
                  }
                  disabled={applyToTaskMutation.isPending}
                >
                  {applyToTaskMutation.isPending ? "Sending..." : "Send application"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selectedHelper && (
        <HelperProfileModal
          helper={{
            ...selectedHelper,
            profileImageUrl: selectedHelper.profileImageUrl || undefined,
            bio: selectedHelper.bio || undefined,
            skills: selectedHelper.skills || undefined,
            hourlyRate: selectedHelper.hourlyRate || undefined,
            averageRating: undefined,
            totalJobsCompleted: selectedHelper.totalJobsCompleted || 0,
            isIdVerified: selectedHelper.isIdVerified || false,
            isBackgroundChecked: selectedHelper.isBackgroundChecked || false,
            isAvailable: selectedHelper.isAvailable || true,
            verificationStatus: selectedHelper.verificationStatus || "pending",
            workExperience: selectedHelper.workExperience || undefined,
            education: selectedHelper.education || undefined,
            certifications: selectedHelper.certifications || undefined,
            portfolioItems: selectedHelper.portfolioItems || undefined,
            city: undefined, // Worker type doesn't have city, using undefined
            transportationMethod: selectedHelper.transportationMethod || undefined,
            maxTravelDistance: selectedHelper.maxTravelDistance || undefined,
          }}
          isOpen={isProfileModalOpen}
          onClose={() => {
            setIsProfileModalOpen(false);
            setSelectedHelper(null);
          }}
        />
      )}
    </WorkerMarketplaceShell>
  );
}

function HelperCard({ worker, onViewProfile }: HelperCardProps) {
  return (
    <Card
      className="cursor-pointer border-white/10 bg-tsCard/90 transition-colors hover:border-ts-orange/45"
      onClick={onViewProfile}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mr-3">
              <Users className="h-6 w-6 text-white/70" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {worker.firstName} {worker.lastName}
              </h3>
              <div className="flex items-center text-sm text-white/60">
                <Briefcase className="mr-1 h-4 w-4" />
                <span>{worker.totalJobsCompleted} jobs completed</span>
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

        <p className="text-white/70 text-sm mb-4 line-clamp-2">
          {worker.bio || "No bio available"}
        </p>

        <div className="flex flex-wrap gap-1 mb-4">
          {worker.skills?.slice(0, 3).map((skill) => (
            <Badge
              key={skill}
              variant="secondary"
              className="text-xs border-white/10 bg-black/25 text-white/60"
            >
              {skill.replace("-", " ")}
            </Badge>
          ))}
          {worker.skills && worker.skills.length > 3 && (
            <Badge
              variant="secondary"
              className="text-xs border-white/10 bg-black/25 text-white/60"
            >
              +{worker.skills.length - 3} more
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center text-sm text-white/60">
            <DollarSign className="h-4 w-4 mr-1" />
            <span>${worker.hourlyRate}/hr</span>
          </div>
          <Button
            size="sm"
            className="bg-ts-orange text-text-black hover:bg-ts-orange/90"
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

export function TaskCard({ task, onApply }: { task: Task; onApply: () => void }) {
  const statusClass =
    task.status === "open"
      ? "bg-green-500/20 text-green-400 border-green-500/50"
      : task.status === "assigned"
        ? "bg-blue-500/20 text-blue-400 border-blue-500/50"
        : "bg-tsCard/95 text-white/60 border-white/15";

  const getPayDisplay = () => {
    if (task.payType === "fixed") {
      return `$${task.payAmount} fixed`;
    } else if (task.payType === "hourly") {
      return `$${task.payAmount}/hr`;
    } else {
      return `$${task.payMin} - $${task.payMax}`;
    }
  };

  return (
    <Card className="border-white/10 bg-tsCard/90 transition-colors hover:border-ts-orange/45">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-2">{task.title}</h3>
            <p className="mb-3 line-clamp-2 text-sm text-white/60">{task.description}</p>
          </div>
          <Badge className={`ml-2 ${statusClass}`}>
            {task.status?.replace("_", " ") || "Unknown"}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-1 mb-4">
          {task.requiredSkills?.slice(0, 3).map((skill) => (
            <Badge
              key={skill}
              variant="secondary"
              className="text-xs border-white/10 bg-black/25 text-white/60"
            >
              {skill.replace("-", " ")}
            </Badge>
          ))}
          {task.requiredSkills && task.requiredSkills.length > 3 && (
            <Badge
              variant="secondary"
              className="text-xs border-white/10 bg-black/25 text-white/60"
            >
              +{task.requiredSkills.length - 3} more
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4 text-sm text-white/60">
          <div className="flex items-center">
            <DollarSign className="h-4 w-4 mr-1" />
            <span>{getPayDisplay()}</span>
          </div>
          <div className="flex items-center">
            <Clock className="h-4 w-4 mr-1" />
            <span>{task.estimatedHours ? `${task.estimatedHours} hrs` : "TBD"}</span>
          </div>
          <div className="flex items-center">
            <MapPin className="h-4 w-4 mr-1" />
            <span>{task.city || "Remote"}</span>
          </div>
          <div className="flex items-center">
            <Shield className="h-4 w-4 mr-1" />
            <span>{task.requiresIdVerification ? "ID Required" : "No ID Required"}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-white/60">
            Posted {task.createdAt ? new Date(task.createdAt).toLocaleDateString() : "Unknown"}
          </span>
          <Button
            size="sm"
            className="bg-ts-orange text-text-black hover:bg-ts-orange/90"
            disabled={task.status !== "open"}
            onClick={onApply}
          >
            {task.status === "open" ? "Apply Now" : "Not Available"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
