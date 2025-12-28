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
import { apiRequest } from "@/lib/queryClient";
import type { WorkRequest, TaskCategory } from "@shared/schema";

export default function TasksHub() {
  const { isAuthenticated } = useAuth();
  const { unreadCount } = useNotifications();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("browse");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskCategoryId, setTaskCategoryId] = useState<string>("");
  const [taskPayType, setTaskPayType] = useState<"fixed" | "hourly" | "per_task">("fixed");
  const [taskPayAmount, setTaskPayAmount] = useState<string>("");
  const [taskTaskType, setTaskTaskType] = useState<"one_time" | "recurring" | "project_based">("one_time");
  const [taskSchedulingType, setTaskSchedulingType] = useState<"asap" | "scheduled" | "flexible">("asap");

  const { data: workRequests, isLoading: requestsLoading } = useQuery<WorkRequest[]>({
    queryKey: ["/api/work-requests", selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory) params.append("category", selectedCategory);

      const response = await fetch(`/api/work-requests?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch work requests");
      return response.json();
    },
    enabled: isAuthenticated,
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

      return apiRequest("POST", "/api/work-requests", {
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        category: taskCategoryId || undefined,
        budgetMin: payAmount,
        budgetMax: payAmount,
      });
    },
    onSuccess: () => {
      toast({ title: "Work request posted", description: "Your request is now on your board." });
      setTaskTitle("");
      setTaskDescription("");
      setTaskCategoryId("");
      setTaskPayAmount("");
      setActiveTab("browse");
      queryClient.invalidateQueries({ queryKey: ["/api/work-requests"] });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't create work request",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const filteredRequests = useMemo(() => {
    if (!workRequests) return [];

    return workRequests.filter((request) => {
      const matchesSearch =
        !searchQuery ||
        request.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.description.toLowerCase().includes(searchQuery.toLowerCase());

      if (selectedCategory && request.category !== selectedCategory) {
        return false;
      }

      return matchesSearch;
    });
  }, [workRequests, searchQuery, selectedCategory]);

  return (
    <div className="w-full max-w-full overflow-x-hidden bg-slate-950">
      <div className="max-w-7xl mx-auto ts-surface px-4 py-6 md:px-10 md:py-8 pb-20">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-3">Work Board</h1>
          <p className="text-lg text-gray-300 max-w-3xl">
            Create and track the work you need done. Each request lives here as a Work Request so Scout and your community can
            help route it over time.
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
                  <h2 className="text-lg font-semibold text-white">Your Work Requests</h2>
                  <p className="text-sm text-gray-300 max-w-xl">
                    This is your personal board of Work Requests. Over time Scout and your community can help match these to
                    the right people.
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search work requests..."
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

            {!isAuthenticated ? (
              <Card className="bg-navy-700 border-navy-600">
                <CardContent className="p-8 text-center">
                  <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">Sign in to use your Work Board</h3>
                  <p className="text-gray-300">
                    Create and track Work Requests from here. Once you sign in, this becomes your command center for projects
                    Scout can help with.
                  </p>
                </CardContent>
              </Card>
            ) : requestsLoading ? (
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
                {filteredRequests.map((request) => (
                  <Card key={request.id} className="bg-navy-700 border-navy-600">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-white mb-1">{request.title}</h3>
                          <p className="text-gray-300 text-sm line-clamp-3">{request.description}</p>
                        </div>
                        <span className="ml-3 text-xs px-2 py-1 rounded-full border border-orange-400 text-orange-300 bg-orange-500/10 capitalize">
                          {request.status?.replace("_", " ") || "open"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-4 text-xs text-gray-400">
                        <span>
                          Budget:{" "}
                          {request.budgetMin || request.budgetMax
                            ? `$${request.budgetMin || request.budgetMax}`
                            : "Not specified"}
                        </span>
                        <span>
                          Created {request.createdAt ? new Date(request.createdAt as any).toLocaleDateString() : "recently"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filteredRequests.length === 0 && (
                  <div className="col-span-full">
                    <Card className="bg-navy-700 border-navy-600">
                      <CardContent className="p-8 text-center">
                        <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-white mb-2">No work requests yet</h3>
                        <p className="text-gray-300">
                          Start by posting a Work Request. This will become your single place to track work you want help
                          with.
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
                <h2 className="text-lg font-semibold text-white mb-1">Create a new Work Request</h2>
                <p className="text-sm text-gray-300">
                  Describe the work you need help with. Scout and your community can use this Work Request to help you route it
                  to the right people over time.
                </p>
              </CardHeader>
              <CardContent>
                {!isAuthenticated ? (
                  <p className="text-sm text-gray-300">
                    You need an account to create Work Requests. Please sign in or create an account first.
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
                        {createTaskMutation.isPending ? "Posting…" : "Post Work Request"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
