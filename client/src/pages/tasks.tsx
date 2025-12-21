import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Briefcase, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/useNotifications";
import { CommunityShell } from "@/components/layout/CommunityShell";
import { apiRequest } from "@/lib/queryClient";
import type { Task, TaskCategory } from "@shared/schema";
import { TaskCard } from "./worker-marketplace";

export default function TasksHub() {
  const { isAuthenticated } = useAuth();
  const { unreadCount } = useNotifications();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("browse");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [locationFilter, setLocationFilter] = useState("");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskCategoryId, setTaskCategoryId] = useState<string>("");
  const [taskPayType, setTaskPayType] = useState<"fixed" | "hourly" | "per_task">("fixed");
  const [taskPayAmount, setTaskPayAmount] = useState<string>("");
  const [taskTaskType, setTaskTaskType] = useState<"one_time" | "recurring" | "project_based">("one_time");
  const [taskSchedulingType, setTaskSchedulingType] = useState<"asap" | "scheduled" | "flexible">("asap");
  const [taskCity, setTaskCity] = useState<string>("");
  const [taskStateCode, setTaskStateCode] = useState<string>("");

  const [applyTask, setApplyTask] = useState<Task | null>(null);
  const [applyMessage, setApplyMessage] = useState("");

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
  });

  const { data: categories } = useQuery<TaskCategory[]>({
    queryKey: ["/api/task-categories"],
  });

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const payAmount = Number(taskPayAmount);
      if (!taskTitle.trim()) throw new Error("Title is required");
      if (!taskDescription.trim()) throw new Error("Description is required");
      if (!Number.isFinite(payAmount) || payAmount <= 0) throw new Error("Pay amount must be a positive number");

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
      setTaskTitle("");
      setTaskDescription("");
      setTaskCategoryId("");
      setTaskPayAmount("");
      setTaskCity("");
      setTaskStateCode("");
      setActiveTab("browse");
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't post task",
        description: err?.message || "Please try again.",
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
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];

    return tasks.filter((task) => {
      const matchesSearch =
        !searchQuery ||
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.requiredSkills?.some((skill) => skill.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesSearch;
    });
  }, [tasks, searchQuery]);

  return (
    <CommunityShell sectionLabel="Tasks" notificationsCount={unreadCount}>
      <div className="max-w-7xl mx-auto ts-surface px-4 py-6 md:px-10 md:py-8 pb-20">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-3">Tasks</h1>
          <p className="text-lg text-gray-300 max-w-3xl">
            Central job posting hub for all user types. Post homeowner jobs, contractor helper roles, and one-time tasks in one
            place, then manage responses from your TradeScout inbox.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="grid w-full grid-cols-2 bg-navy-700 border-navy-600">
            <TabsTrigger value="browse" className="data-[state=active]:bg-orange-500">
              <Briefcase className="h-4 w-4 mr-2" />
              Browse Tasks
            </TabsTrigger>
            <TabsTrigger value="post" className="data-[state=active]:bg-orange-500">
              Post a Task
            </TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="mt-6">
            <Card className="bg-navy-800 border-navy-700 mb-6">
              <CardHeader className="pb-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <h2 className="text-lg font-semibold text-white">Find work that fits you</h2>
                  <p className="text-sm text-gray-300 max-w-xl">
                    Filter by category and location to find helper roles, side gigs, and household tasks that match your skills
                    and availability.
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search tasks..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-navy-600 border-navy-500 text-white"
                    />
                  </div>

                  <Select
                    value={selectedCategory || "all"}
                    onValueChange={(value) => setSelectedCategory(value === "all" ? "" : value)}
                  >
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

                  <div className="hidden md:flex items-center justify-end">
                    {isAuthenticated && (
                      <Button
                        className="bg-orange-500 hover:bg-orange-600"
                        onClick={() => setActiveTab("post")}
                      >
                        Post a Task
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {tasksLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="bg-navy-700 border-navy-600 animate-pulse">
                    <CardContent className="p-6">
                      <div className="h-4 bg-navy-600 rounded mb-4" />
                      <div className="h-20 bg-navy-600 rounded mb-4" />
                      <div className="h-4 bg-navy-600 rounded" />
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
                    <Card className="bg-navy-700 border-navy-600">
                      <CardContent className="p-8 text-center">
                        <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-white mb-2">No tasks found</h3>
                        <p className="text-gray-300">
                          Try adjusting your search or filters. Tasks include contractor helper roles, homeowner jobs, and
                          one-time gigs.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="post" className="mt-6">
            <Card className="bg-navy-800 border-navy-700">
              <CardHeader className="pb-4">
                <h2 className="text-lg font-semibold text-white mb-1">Post a new task</h2>
                <p className="text-sm text-gray-300">
                  Homeowners can post jobs around the house. Contractors can post helper roles for job sites or overflow work.
                </p>
              </CardHeader>
              <CardContent>
                {!isAuthenticated ? (
                  <p className="text-sm text-gray-300">
                    You need an account to post tasks. Please sign in or create an account first.
                  </p>
                ) : (
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label>Title</Label>
                      <Input
                        value={taskTitle}
                        onChange={(e) => setTaskTitle(e.target.value)}
                        className="bg-navy-700 border-navy-600 text-white"
                        placeholder="e.g., Help moving a couch"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label>Description</Label>
                      <Textarea
                        value={taskDescription}
                        onChange={(e) => setTaskDescription(e.target.value)}
                        className="bg-navy-700 border-navy-600 text-white"
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
                          <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                          <SelectContent className="bg-navy-700 border-navy-600">
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
                          <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-navy-700 border-navy-600">
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
                          <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-navy-700 border-navy-600">
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
                          className="bg-navy-700 border-navy-600 text-white"
                          placeholder="e.g., 150"
                          inputMode="decimal"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Scheduling</Label>
                        <Select value={taskSchedulingType} onValueChange={(v) => setTaskSchedulingType(v as any)}>
                          <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-navy-700 border-navy-600">
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
                          className="bg-navy-700 border-navy-600 text-white"
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
                          className="bg-navy-700 border-navy-600 text-white"
                          placeholder="e.g., TX"
                          maxLength={2}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        className="border-gray-300 text-gray-300 hover:bg-gray-300 hover:text-navy-800"
                        onClick={() => {
                          setTaskTitle("");
                          setTaskDescription("");
                          setTaskCategoryId("");
                          setTaskPayAmount("");
                          setTaskCity("");
                          setTaskStateCode("");
                        }}
                        disabled={createTaskMutation.isPending}
                      >
                        Clear
                      </Button>
                      <Button
                        className="bg-orange-500 hover:bg-orange-600"
                        onClick={() => createTaskMutation.mutate()}
                        disabled={createTaskMutation.isPending}
                      >
                        {createTaskMutation.isPending ? "Posting…" : "Post task"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={Boolean(applyTask)} onOpenChange={(open) => !open && setApplyTask(null)}>
          <DialogContent className="bg-navy-800 border-navy-600 text-white">
            <DialogHeader>
              <DialogTitle>Apply to task</DialogTitle>
            </DialogHeader>

            {applyTask && (
              <div className="grid gap-4">
                <div className="text-sm text-gray-300">
                  <div className="font-semibold text-white">{applyTask.title}</div>
                  <div className="mt-1">{applyTask.description}</div>
                </div>

                <div className="grid gap-2">
                  <Label>Message (optional)</Label>
                  <Textarea
                    value={applyMessage}
                    onChange={(e) => setApplyMessage(e.target.value)}
                    className="bg-navy-700 border-navy-600 text-white"
                    placeholder="Tell them why you're a good fit"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    className="border-gray-300 text-gray-300 hover:bg-gray-300 hover:text-navy-800"
                    onClick={() => setApplyTask(null)}
                    disabled={applyToTaskMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="bg-orange-500 hover:bg-orange-600"
                    onClick={() =>
                      applyToTaskMutation.mutate({
                        taskId: applyTask.id,
                        message: applyMessage.trim() || undefined,
                      })
                    }
                    disabled={applyToTaskMutation.isPending}
                  >
                    {applyToTaskMutation.isPending ? "Sending…" : "Send application"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </CommunityShell>
  );
}
