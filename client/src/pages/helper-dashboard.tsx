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
  const { data: availableTasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ['/api/tasks/available'],
    enabled: activeTab === "find-work",
  });

  // Fetch helper's applications
  const { data: applications = [], isLoading: applicationsLoading } = useQuery<TaskApplication[]>({
    queryKey: ['/api/workers/applications'],
    enabled: activeTab === "applications",
  });

  // Fetch helper's completed jobs
  const { data: completedJobs = [], isLoading: jobsLoading } = useQuery<Task[]>({
    queryKey: ['/api/workers/completed-jobs'],
    enabled: activeTab === "completed-jobs",
  });

  // Fetch helper's reviews
  const { data: reviews = [], isLoading: reviewsLoading } = useQuery<WorkerReview[]>({
    queryKey: ['/api/workers/reviews'],
    enabled: activeTab === "reviews",
  });

  return (
    <div className="min-h-screen bg-tsBg p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Helper Dashboard</h1>
          <p className="text-gray-400 mt-2">Manage your tasks and grow your reputation</p>
        </div>
      </div>
    </div>
  );
}