import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function HomeownerDashboard() {
  const [, setLocation] = useLocation();

  return (
    <EmptyState
      title="Homeowner dashboard"
      message="Your homeowner dashboard will fill in as you start Direct Connect requests and work with contractors. Start by opening Direct Connect or browsing contractors."
      action={
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => setLocation("/tasks")}>
            Open Direct Connect
          </Button>
          <Button variant="outline" onClick={() => setLocation("/contractors")}>
            Browse contractors
          </Button>
        </div>
      }
    />
  );
}
