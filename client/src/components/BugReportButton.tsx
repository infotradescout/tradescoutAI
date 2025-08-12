import React, { useState, useRef, useContext } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Bug, Send, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";

interface BugReportData {
  type: string;
  title: string;
  description: string;
  steps: string;
  expected: string;
  actual: string;
  url: string;
  userAgent: string;
}

export function BugReportButton() {
  try {
    const { toast } = useToast();
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [bugData, setBugData] = useState<BugReportData>({
      type: "",
      title: "",
      description: "",
      steps: "",
      expected: "",
      actual: "",
      url: "",
      userAgent: navigator.userAgent,
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { id, value } = e.target;
      setBugData((prev) => ({
        ...prev,
        [id]: value,
      }));
    };

    const handleSelectChange = (value: string, field: string) => {
      setBugData((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

    const submitBugReport = useMutation({
      mutationFn: async (data: BugReportData) => {
        const response = await fetch("/api/bug-report", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });
        if (!response.ok) {
          throw new Error("Failed to submit bug report");
        }
        return response.json();
      },
      onSuccess: () => {
        toast({
          title: "Bug Report Sent",
          description: "Thank you for your feedback!",
        });
        setIsOpen(false);
        setBugData({
          type: "",
          title: "",
          description: "",
          steps: "",
          expected: "",
          actual: "",
          url: "",
          userAgent: navigator.userAgent,
        });
      },
      onError: (error) => {
        toast({
          title: "Error Sending Bug Report",
          description: error.message || "Please try again later.",
          variant: "destructive",
        });
      },
    });

    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-50 bg-red-600 hover:bg-red-700 text-white border-red-500"
        >
          <Bug className="h-4 w-4 mr-2" />
          Report Bug
        </Button>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Report a Bug</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="type">Type of Issue</Label>
                <Select onValueChange={(value) => handleSelectChange(value, "type")} value={bugData.type}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select issue type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bug">Bug</SelectItem>
                    <SelectItem value="feature-request">Feature Request</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={bugData.title}
                  onChange={(e) => handleInputChange(e)}
                  placeholder="Briefly summarize the issue"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={bugData.description}
                  onChange={(e) => handleInputChange(e)}
                  placeholder="Describe the bug you encountered..."
                  className="min-h-[100px]"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="steps">Steps to Reproduce</Label>
                <Textarea
                  id="steps"
                  value={bugData.steps}
                  onChange={(e) => handleInputChange(e)}
                  placeholder="List the steps to reproduce the bug..."
                  className="min-h-[100px]"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="expected">Expected Behavior</Label>
                <Textarea
                  id="expected"
                  value={bugData.expected}
                  onChange={(e) => handleInputChange(e)}
                  placeholder="What should have happened?"
                  className="min-h-[100px]"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="actual">Actual Behavior</Label>
                <Textarea
                  id="actual"
                  value={bugData.actual}
                  onChange={(e) => handleInputChange(e)}
                  placeholder="What actually happened?"
                  className="min-h-[100px]"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="url">URL (optional)</Label>
                <Input
                  id="url"
                  value={bugData.url}
                  onChange={(e) => handleInputChange(e)}
                  placeholder="Paste the URL where the bug occurred..."
                />
              </div>
            </div>
            <Button
              type="submit"
              onClick={() => submitBugReport.mutate(bugData)}
              disabled={submitBugReport.isPending}
            >
              {submitBugReport.isPending ? "Sending..." : "Send Report"}
            </Button>
          </DialogContent>
        </Dialog>
      </>
    );
  } catch (error) {
    console.error('BugReportButton error:', error);
    return (
      <div className="fixed bottom-4 left-4 z-50">
        <Button variant="outline" size="sm" disabled>
          <Bug className="h-4 w-4 mr-2" />
          Report Issue
        </Button>
      </div>
    );
  }
}