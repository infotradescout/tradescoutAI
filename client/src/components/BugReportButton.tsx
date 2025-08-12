import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Bug } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function BugReportButton() {
  const [isOpen, setIsOpen] = useState(false);

  try {
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
                <Label htmlFor="bug-description">Description</Label>
                <Textarea
                  id="bug-description"
                  placeholder="Describe the bug you encountered..."
                  className="min-h-[100px]"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bug-report-url">URL (optional)</Label>
                <Textarea
                  id="bug-report-url"
                  placeholder="Paste the URL where the bug occurred..."
                  className="min-h-[50px]"
                />
              </div>
            </div>
            <Button type="submit">Send Report</Button>
          </DialogContent>
        </Dialog>
      </>
    );
  } catch (error) {
    console.error('BugReportButton error:', error);
    return null;
  }
}