import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function HomeownerDashboard() {
  const [, setLocation] = useLocation();

  return (
    <EmptyState
      title="Requester dashboard"
      message="Your requester dashboard will fill in as you start requests and work with providers. Start by opening Direct Connect and routing your first job."
      action={
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => setLocation("/direct-connect")}>Start a Request</Button>
        </div>
      }
    />
  );
}
