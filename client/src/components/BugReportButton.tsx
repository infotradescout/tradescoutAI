import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bug, Camera, Check, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';

interface BugReportButtonProps {
  className?: string;
}

export function BugReportButton({ className }: BugReportButtonProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const captureAndSubmitBug = async () => {
    try {
      setIsCapturing(true);
      
      // Capture screenshot
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        scale: 0.8, // Reduce size for faster upload
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: 0,
        scrollY: 0
      });
      
      // Convert to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob!);
        }, 'image/jpeg', 0.8);
      });
      
      setIsCapturing(false);
      setIsSubmitting(true);

      // Get user context
      const userAgent = navigator.userAgent;
      const url = window.location.href;
      const timestamp = new Date().toISOString();
      const viewport = `${window.innerWidth}x${window.innerHeight}`;
      
      // Convert screenshot to base64 for JSON submission
      const base64Screenshot = canvas.toDataURL('image/jpeg', 0.8);
      
      // Submit bug report with JSON payload
      const response = await fetch('/api/bug-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'One-Tap Bug Report',
          description: 'Automatically captured screenshot and page context',
          screenshot: base64Screenshot,
          userAgent,
          url,
          timestamp,
          viewport,
          type: 'automatic_screenshot'
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit bug report');
      }
      
      const result = await response.json();
      
      toast({
        title: "Bug Report Sent!",
        description: `Report #${result.reportId} submitted successfully. Thank you for helping improve TradeScout!`,
        duration: 4000,
      });
      
    } catch (error) {
      console.error('Error submitting bug report:', error);
      toast({
        title: "Error Sending Report",
        description: "Could not submit bug report. Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setIsCapturing(false);
      setIsSubmitting(false);
    }
  };

  const getButtonContent = () => {
    if (isCapturing) {
      return (
        <>
          <Camera className="h-4 w-4 animate-pulse" />
          <span className="ml-2">Capturing...</span>
        </>
      );
    }
    
    if (isSubmitting) {
      return (
        <>
          <AlertCircle className="h-4 w-4 animate-spin" />
          <span className="ml-2">Sending...</span>
        </>
      );
    }
    
    return (
      <>
        <Bug className="h-4 w-4" />
        <span className="ml-2">Report Bug</span>
      </>
    );
  };

  return (
    <Button
      onClick={captureAndSubmitBug}
      disabled={isCapturing || isSubmitting}
      variant="outline"
      size="sm"
      className={`
        bg-red-500 hover:bg-red-600 
        border-red-500 hover:border-red-600 
        text-white hover:text-white
        transition-all duration-200
        shadow-lg hover:shadow-xl
        ${className}
      `}
      title="One-tap screenshot bug report"
    >
      {getButtonContent()}
    </Button>
  );
}