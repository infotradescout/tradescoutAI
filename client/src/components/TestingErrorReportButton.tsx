import { useState, useRef } from "react";
import { Bug, X, Send, TestTube, Zap, Camera, Upload, Image, Loader2 } from "lucide-react";
import html2canvas from 'html2canvas';
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

interface TestingErrorReportButtonProps {
  variant?: 'floating' | 'banner' | 'prominent';
  showTestingLabel?: boolean;
}

export function TestingErrorReportButton({ 
  variant = 'floating', 
  showTestingLabel = true 
}: TestingErrorReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [errorType, setErrorType] = useState("bug");
  const [userEmail, setUserEmail] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      setScreenshot(null);
      setUploadedFiles([]);
    },
    onError: (error) => {
      toast({
        title: "Failed to Submit Report",
        description: "Please try again or contact support directly.",
        variant: "destructive",
      });
    },
  });

  const captureScreenshot = async () => {
    setIsCapturingScreenshot(true);
    try {
      // Hide the dialog temporarily to capture clean screenshot
      setIsOpen(false);
      
      // Wait a moment for dialog to close
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const canvas = await html2canvas(document.body, {
        height: window.innerHeight,
        width: window.innerWidth,
        scrollX: 0,
        scrollY: 0,
        useCORS: true,
        allowTaint: true,
      });
      
      const screenshotDataUrl = canvas.toDataURL('image/png');
      setScreenshot(screenshotDataUrl);
      
      // Reopen the dialog
      setIsOpen(true);
      
      toast({
        title: "Screenshot Captured",
        description: "Screenshot will be included with your report.",
      });
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      toast({
        title: "Screenshot Failed",
        description: "Unable to capture screenshot, but you can still submit the report.",
        variant: "destructive",
      });
      setIsOpen(true);
    }
    setIsCapturingScreenshot(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles = Array.from(files).filter(file => {
        // Limit file size to 5MB
        if (file.size > 5 * 1024 * 1024) {
          toast({
            title: "File Too Large",
            description: `${file.name} is too large. Max size is 5MB.`,
            variant: "destructive",
          });
          return false;
        }
        return true;
      });
      setUploadedFiles(prev => [...prev, ...newFiles].slice(0, 3)); // Max 3 files
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFilesToStorage = async (files: (File | string)[]): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    
    for (const file of files) {
      try {
        let uploadData;
        
        if (typeof file === 'string') {
          // Screenshot data URL
          const response = await fetch(file);
          const blob = await response.blob();
          uploadData = blob;
        } else {
          // Regular file
          uploadData = file;
        }
        
        // Get upload URL from backend
        const uploadResponse = await apiRequest("POST", "/api/objects/upload");
        const { uploadURL } = await uploadResponse.json();
        
        // Upload to object storage
        await fetch(uploadURL, {
          method: 'PUT',
          body: uploadData,
          headers: {
            'Content-Type': typeof file === 'string' ? 'image/png' : file.type,
          },
        });
        
        uploadedUrls.push(uploadURL);
      } catch (error) {
        console.error('File upload failed:', error);
        toast({
          title: "Upload Failed",
          description: "Some files couldn't be uploaded, but your report will still be submitted.",
          variant: "destructive",
        });
      }
    }
    
    return uploadedUrls;
  };

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

    // Upload files if any
    const filesToUpload = [];
    if (screenshot) filesToUpload.push(screenshot);
    if (uploadedFiles.length > 0) filesToUpload.push(...uploadedFiles);
    
    const attachmentUrls = filesToUpload.length > 0 ? await uploadFilesToStorage(filesToUpload) : [];

    const reportData = {
      title: title.trim(),
      description: description.trim(),
      errorType,
      userEmail: userEmail.trim() || user?.email || null,
      currentUrl: window.location.href,
      userAgent: navigator.userAgent,
      attachments: attachmentUrls,
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
    const match = userAgent.match(/(Chrome|Firefox|Safari|Edge)\/(\d+)/);
    return match ? match[2] : 'Unknown';
  };

  const generateTestReport = (type: 'bug' | 'ui_issue' | 'performance' | 'feature_request') => {
    const testReports = {
      bug: {
        title: "Test Bug Report - Page Loading Issue",
        description: "This is a test bug report. The contractor dashboard fails to load properly on mobile devices. The loading spinner appears but content never shows up.",
        errorType: "bug"
      },
      ui_issue: {
        title: "Test UI Issue - Button Alignment",
        description: "Testing UI issue reporting. The search filters are misaligned on tablet screens, making it difficult to use the contractor search functionality.",
        errorType: "ui_issue"
      },
      performance: {
        title: "Test Performance Issue - Slow Loading",
        description: "Testing performance reporting. The contractor list takes more than 10 seconds to load, especially when filtering by multiple criteria.",
        errorType: "performance"
      },
      feature_request: {
        title: "Test Feature Request - Dark Mode",
        description: "Testing feature request submission. Would love to have a dark mode option for better viewing during evening hours.",
        errorType: "feature_request"
      }
    };

    const testData = testReports[type];
    setTitle(testData.title);
    setDescription(testData.description);
    setErrorType(testData.errorType);
    setUserEmail("test@example.com");
  };

  if (variant === 'banner') {
    return (
      <>
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TestTube className="h-5 w-5 text-orange-400" />
              <div>
                <h3 className="text-orange-400 font-semibold">Testing Mode: Bug Reporting System</h3>
                <p className="text-orange-300 text-sm">Try out the error reporting system - all reports are visible in the admin panel.</p>
              </div>
            </div>
            <Button
              onClick={() => setIsOpen(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Bug className="h-4 w-4 mr-2" />
              Test Report Bug
            </Button>
          </div>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="sm:max-w-[600px] bg-navy-800 border-navy-600">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Bug className="h-5 w-5 text-orange-400" />
                {showTestingLabel ? "Test Bug Report" : "Report an Issue"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Quick Test Buttons */}
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                <Label className="text-orange-400 text-sm font-semibold">Quick Test Reports:</Label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <Button 
                    type="button"
                    onClick={() => generateTestReport('bug')}
                    size="sm"
                    variant="outline"
                    className="border-orange-500/50 text-orange-300 hover:bg-orange-500/20"
                  >
                    Test Bug
                  </Button>
                  <Button 
                    type="button"
                    onClick={() => generateTestReport('ui_issue')}
                    size="sm"
                    variant="outline"
                    className="border-orange-500/50 text-orange-300 hover:bg-orange-500/20"
                  >
                    Test UI Issue
                  </Button>
                  <Button 
                    type="button"
                    onClick={() => generateTestReport('performance')}
                    size="sm"
                    variant="outline"
                    className="border-orange-500/50 text-orange-300 hover:bg-orange-500/20"
                  >
                    Test Performance
                  </Button>
                  <Button 
                    type="button"
                    onClick={() => generateTestReport('feature_request')}
                    size="sm"
                    variant="outline"
                    className="border-orange-500/50 text-orange-300 hover:bg-orange-500/20"
                  >
                    Test Feature Request
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="issue-type" className="text-gray-300">Issue Type</Label>
                <Select value={errorType} onValueChange={setErrorType}>
                  <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                    <SelectValue placeholder="Select issue type" />
                  </SelectTrigger>
                  <SelectContent className="bg-navy-700 border-navy-600">
                    <SelectItem value="bug">🐛 Bug/Error</SelectItem>
                    <SelectItem value="ui_issue">🎨 UI Issue</SelectItem>
                    <SelectItem value="performance">⚡ Performance</SelectItem>
                    <SelectItem value="feature_request">💡 Feature Request</SelectItem>
                    <SelectItem value="other">❓ Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title" className="text-gray-300">Issue Summary</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Brief description of the issue"
                  className="bg-navy-700 border-navy-600 text-white placeholder:text-gray-400"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-gray-300">Detailed Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what happened, what you expected, and steps to reproduce the issue..."
                  className="bg-navy-700 border-navy-600 text-white placeholder:text-gray-400 min-h-[100px]"
                  required
                />
              </div>

              {!isAuthenticated && (
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-300">Email (optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    className="bg-navy-700 border-navy-600 text-white placeholder:text-gray-400"
                  />
                </div>
              )}

              {/* Screenshot and File Upload Section */}
              <div className="space-y-4">
                <div className="border-t border-navy-600 pt-4">
                  <Label className="text-gray-300 text-sm font-semibold">Attachments</Label>
                  <p className="text-gray-400 text-xs mb-3">Screenshots and files help us understand the issue better</p>
                  
                  <div className="flex gap-2 mb-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={captureScreenshot}
                      disabled={isCapturingScreenshot}
                      className="border-navy-500 text-gray-300 hover:bg-navy-600"
                    >
                      {isCapturingScreenshot ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4 mr-1" />
                      )}
                      {isCapturingScreenshot ? 'Capturing...' : 'Take Screenshot'}
                    </Button>
                    
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="border-navy-500 text-gray-300 hover:bg-navy-600"
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      Upload Files
                    </Button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.txt,.log"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  {/* Screenshots Preview */}
                  {screenshot && (
                    <div className="bg-navy-700 rounded-lg p-3 mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Image className="h-4 w-4 text-green-400" />
                          <span className="text-green-400 text-sm">Screenshot captured</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setScreenshot(null)}
                          className="text-gray-400 hover:text-white"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <img
                        src={screenshot}
                        alt="Screenshot preview"
                        className="max-w-full h-32 object-cover rounded border border-navy-600"
                      />
                    </div>
                  )}

                  {/* Uploaded Files List */}
                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2">
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-navy-700 rounded-lg p-2">
                          <div className="flex items-center gap-2">
                            <Upload className="h-4 w-4 text-blue-400" />
                            <span className="text-white text-sm truncate">{file.name}</span>
                            <span className="text-gray-400 text-xs">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                            className="text-gray-400 hover:text-white"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  className="border-navy-500 text-gray-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={reportMutation.isPending}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {reportMutation.isPending ? (
                    "Submitting..."
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Submit Report
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (variant === 'prominent') {
    return (
      <>
        <Button
          onClick={() => setIsOpen(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white shadow-lg"
          size="lg"
        >
          <Bug className="h-5 w-5 mr-2" />
          {showTestingLabel ? "Test Bug Report System" : "Report Bug"}
        </Button>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="sm:max-w-[600px] bg-navy-800 border-navy-600">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Bug className="h-5 w-5 text-orange-400" />
                {showTestingLabel ? "Test Bug Report" : "Report an Issue"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* ... same form content as banner variant ... */}
            </form>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Default floating variant
  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-orange-500 hover:bg-orange-600 text-white shadow-lg rounded-full p-4 
                   md:bottom-6 md:right-6 
                   max-md:bottom-20 max-md:right-4 max-md:p-3 
                   transition-all duration-300 hover:scale-105"
        size="icon"
      >
        <Bug className="h-6 w-6 max-md:h-5 max-md:w-5" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[600px] bg-navy-800 border-navy-600">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Bug className="h-5 w-5 text-orange-400" />
              {showTestingLabel ? "Test Bug Report" : "Report an Issue"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ... same form content as banner variant ... */}
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}