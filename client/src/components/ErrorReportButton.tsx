import { useState } from "react";
import { Bug, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

export function ErrorReportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [errorType, setErrorType] = useState("bug");
  const [userEmail, setUserEmail] = useState("");
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();

  const reportMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/error-reports", data);
    },
    onSuccess: () => {
      toast({
        title: "Report Submitted",
        description: "Thank you! We'll look into this issue right away.",
      });
      setIsOpen(false);
      setTitle("");
      setDescription("");
      setErrorType("bug");
      setUserEmail("");
    },
    onError: (error) => {
      toast({
        title: "Failed to Submit Report",
        description: "Please try again or contact support directly.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !description.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in both title and description.",
        variant: "destructive",
      });
      return;
    }

    const reportData = {
      title: title.trim(),
      description: description.trim(),
      errorType,
      userEmail: userEmail.trim() || user?.email || null,
      currentUrl: window.location.href,
      userAgent: navigator.userAgent,
      browserInfo: {
        name: getBrowserName(),
        version: getBrowserVersion(),
        platform: navigator.platform,
        mobile: /Mobile|Android|iPhone|iPad/.test(navigator.userAgent),
      },
    };

    reportMutation.mutate(reportData);
  };

  const getBrowserName = () => {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Unknown';
  };

  const getBrowserVersion = () => {
    const userAgent = navigator.userAgent;
    const match = userAgent.match(/(Chrome|Firefox|Safari|Edge)\/(\d+\.?\d*)/);
    return match ? match[2] : 'Unknown';
  };

  return (
    <>
      {/* Floating Report Bug Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-red-500 hover:bg-red-600 shadow-lg hover:shadow-xl transition-all duration-200"
        title="Report a bug or issue"
      >
        <Bug className="h-6 w-6" />
      </Button>

      {/* Report Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px] bg-navy-800 border-navy-600">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Bug className="h-5 w-5 text-red-500" />
              Report an Issue
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="error-type" className="text-gray-300">
                Issue Type
              </Label>
              <Select value={errorType} onValueChange={setErrorType}>
                <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-navy-700 border-navy-600">
                  <SelectItem value="bug">Bug/Error</SelectItem>
                  <SelectItem value="ui_issue">UI/Design Issue</SelectItem>
                  <SelectItem value="performance">Performance Problem</SelectItem>
                  <SelectItem value="feature_request">Feature Request</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="title" className="text-gray-300">
                Quick Summary <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief description of the issue..."
                className="bg-navy-700 border-navy-600 text-white placeholder-gray-400"
                maxLength={200}
              />
            </div>

            <div>
              <Label htmlFor="description" className="text-gray-300">
                Detailed Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What happened? What were you trying to do? What did you expect to happen?"
                className="bg-navy-700 border-navy-600 text-white placeholder-gray-400 min-h-[100px]"
                rows={4}
              />
            </div>

            {!isAuthenticated && (
              <div>
                <Label htmlFor="email" className="text-gray-300">
                  Email (optional)
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="your@email.com (for follow-up)"
                  className="bg-navy-700 border-navy-600 text-white placeholder-gray-400"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="border-navy-600 text-gray-300"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={reportMutation.isPending}
                className="bg-red-500 hover:bg-red-600"
              >
                <Send className="h-4 w-4 mr-2" />
                {reportMutation.isPending ? "Sending..." : "Send Report"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}