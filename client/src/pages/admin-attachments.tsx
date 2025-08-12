
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Eye, Trash2, Image, FileText, Calendar, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";

interface ErrorReportWithAttachments {
  id: string;
  title: string;
  description: string;
  errorType: string;
  userEmail?: string;
  attachments?: string[];
  createdAt: string;
  status: string;
}

export default function AdminAttachments() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("all");

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['/api/admin/error-reports'],
  });

  // Filter reports that have attachments
  const reportsWithAttachments = reports.filter((report: ErrorReportWithAttachments) => 
    report.attachments && report.attachments.length > 0
  );

  const filteredReports = filterType === "all" 
    ? reportsWithAttachments 
    : reportsWithAttachments.filter((report: ErrorReportWithAttachments) => 
        report.errorType === filterType
      );

  const getAttachmentType = (url: string) => {
    if (url.includes('screenshot') || url.includes('image') || url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      return 'image';
    }
    return 'file';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-navy-900 text-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-navy-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-900 text-white">
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">User Submitted Attachments</h1>
          <p className="text-gray-400">Screenshots and files from bug reports and error submissions</p>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-48 bg-navy-700 border-navy-600 text-white">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent className="bg-navy-700 border-navy-600">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="bug">Bug Reports</SelectItem>
              <SelectItem value="ui_issue">UI Issues</SelectItem>
              <SelectItem value="performance">Performance</SelectItem>
              <SelectItem value="feature_request">Feature Requests</SelectItem>
            </SelectContent>
          </Select>

          <div className="text-sm text-gray-400 flex items-center">
            Total reports with attachments: {reportsWithAttachments.length}
          </div>
        </div>

        {filteredReports.length === 0 ? (
          <Card className="bg-navy-800 border-navy-700">
            <CardContent className="flex items-center justify-center h-32">
              <p className="text-gray-400">No reports with attachments found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredReports.map((report: ErrorReportWithAttachments) => (
              <Card key={report.id} className="bg-navy-800 border-navy-700">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-white text-lg">{report.title}</CardTitle>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(report.createdAt)}
                        </div>
                        {report.userEmail && (
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {report.userEmail}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={report.status === 'resolved' ? 'default' : 'secondary'}>
                        {report.status}
                      </Badge>
                      <Badge variant="outline">
                        {report.errorType}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-300 mb-4">{report.description}</p>
                  
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-200">
                      Attachments ({report.attachments?.length || 0})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {report.attachments?.map((attachment, index) => {
                        const attachmentType = getAttachmentType(attachment);
                        return (
                          <div key={index} className="border border-navy-600 rounded-lg p-3 bg-navy-700">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {attachmentType === 'image' ? (
                                  <Image className="h-4 w-4 text-blue-400" />
                                ) : (
                                  <FileText className="h-4 w-4 text-gray-400" />
                                )}
                                <span className="text-sm text-gray-300">
                                  {attachmentType === 'image' ? 'Screenshot' : 'File'}
                                </span>
                              </div>
                            </div>
                            
                            {attachmentType === 'image' && (
                              <div className="mb-3">
                                <img 
                                  src={attachment} 
                                  alt="User screenshot"
                                  className="w-full h-32 object-cover rounded cursor-pointer hover:opacity-80"
                                  onClick={() => setSelectedImage(attachment)}
                                />
                              </div>
                            )}
                            
                            <div className="flex gap-2">
                              {attachmentType === 'image' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedImage(attachment)}
                                  className="border-navy-500 text-gray-300 hover:bg-navy-600"
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  View
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(attachment, '_blank')}
                                className="border-navy-500 text-gray-300 hover:bg-navy-600"
                              >
                                <Download className="h-3 w-3 mr-1" />
                                Download
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Image Preview Modal */}
        <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-4xl bg-navy-800 border-navy-700">
            <DialogHeader>
              <DialogTitle className="text-white">Screenshot Preview</DialogTitle>
            </DialogHeader>
            {selectedImage && (
              <div className="flex justify-center">
                <img 
                  src={selectedImage} 
                  alt="Full size screenshot"
                  className="max-w-full max-h-[70vh] object-contain rounded"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
