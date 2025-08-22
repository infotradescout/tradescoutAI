import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Bug, Camera, Send, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';

interface BugReportData {
  description: string;
  email: string;
  page: string;
  userAgent: string;
  timestamp: string;
  screenshot?: string;
}

export function BugReportTool() {
  const [isOpen, setIsOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [screenshotTaken, setScreenshotTaken] = useState(false);
  const { toast } = useToast();

  const captureScreenshot = async (): Promise<string | null> => {
    try {
      const canvas = await html2canvas(document.body, {
        height: window.innerHeight,
        width: window.innerWidth,
        scrollX: 0,
        scrollY: 0,
        useCORS: true,
        allowTaint: true,
        scale: 0.5, // Reduce size for faster upload
      });
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      return null;
    }
  };

  const submitBugReport = async () => {
    if (!description.trim()) {
      toast({
        title: "Description Required",
        description: "Please describe the bug you encountered.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Capture screenshot automatically
      const screenshot = await captureScreenshot();
      setScreenshotTaken(true);

      const bugReportData: BugReportData = {
        description: description.trim(),
        email: email.trim() || 'anonymous',
        page: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        screenshot: screenshot || undefined,
      };

      // Submit to Formspree
      const formData = new FormData();
      formData.append('description', bugReportData.description);
      formData.append('email', bugReportData.email);
      formData.append('page', bugReportData.page);
      formData.append('userAgent', bugReportData.userAgent);
      formData.append('timestamp', bugReportData.timestamp);
      
      if (screenshot) {
        // Convert data URL to blob
        const response = await fetch(screenshot);
        const blob = await response.blob();
        formData.append('screenshot', blob, 'bug-screenshot.jpg');
      }

      // Submit through our API endpoint which will forward to Formspree
      const submitResponse = await fetch('/api/bug-report', {
        method: 'POST',
        body: formData
      });

      if (submitResponse.ok) {
        toast({
          title: "Bug Report Sent!",
          description: "Thank you for helping us improve TradeScout. We'll investigate this issue soon.",
        });
        
        // Reset form
        setDescription('');
        setEmail('');
        setIsOpen(false);
        setScreenshotTaken(false);
      } else {
        throw new Error('Failed to submit bug report');
      }
    } catch (error) {
      console.error('Bug report submission failed:', error);
      toast({
        title: "Submission Failed",
        description: "Please try again or contact support directly.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="fixed bottom-4 right-4 z-50 bg-red-500 hover:bg-red-600 text-white border-red-600 shadow-lg"
          data-testid="bug-report-button"
        >
          <Bug className="h-4 w-4 mr-2" />
          Report Bug
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-red-500" />
            Report a Bug
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bug-description">What went wrong?</Label>
            <Textarea
              id="bug-description"
              placeholder="Describe the bug you encountered..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              data-testid="bug-description-input"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="bug-email">Email (optional)</Label>
            <Input
              id="bug-email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="bug-email-input"
            />
            <p className="text-xs text-gray-500">
              Leave blank to submit anonymously
            </p>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 text-blue-700 text-sm">
              <Camera className="h-4 w-4" />
              <span className="font-medium">
                {screenshotTaken ? 'Screenshot captured!' : 'Screenshot will be captured automatically'}
              </span>
            </div>
            <p className="text-xs text-blue-600 mt-1">
              We'll automatically include a screenshot to help us understand the issue
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={submitBugReport}
              disabled={isSubmitting}
              className="flex-1"
              data-testid="submit-bug-report"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Report
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default BugReportTool;