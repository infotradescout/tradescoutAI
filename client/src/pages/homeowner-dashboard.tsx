import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function HomeownerDashboard() {
  const [, setLocation] = useLocation();

  return (
    <EmptyState
      title="Homeowner dashboard"
      message="Your homeowner dashboard will fill in as you post projects and work with contractors. Start by posting a job or browsing local pros."
      action={
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => setLocation("/helpers?tab=post-task")}>
            Post a job
          </Button>
          <Button variant="outline" onClick={() => setLocation("/contractors")}>
            Browse contractors
          </Button>
        </div>
      }
    />
  );
}
