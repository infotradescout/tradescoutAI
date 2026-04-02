import { useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, ShieldCheck } from "lucide-react";

export default function ContactGatePage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/scout?intent=support&source=contact-page");
  }, [setLocation]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-2xl bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-ts-orange" />
            Contact Requires Intent Confirmation
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Start in Scout or Direct Connect so your request stays organized and you do not get hit
            with random outreach.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            className="w-full bg-ts-orange-dark hover:bg-ts-orange-dark"
            onClick={() => setLocation("/scout?intent=support&source=contact-cta")}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Continue in Scout
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setLocation("/direct-connect?intent=support&source=contact-cta")}
          >
            Open Direct Connect
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
