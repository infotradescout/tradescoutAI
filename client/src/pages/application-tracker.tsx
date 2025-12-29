import { memo, useState } from 'react';
import { FileText, Clock, CheckCircle, XCircle, AlertCircle, Eye, Download, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ApplicationTracker = memo(function ApplicationTracker() {
  const [activeTab, setActiveTab] = useState("all");

  const applications = [
    {
      id: "APP-2024-001",
      type: "Contractor License",
      applicant: "Mike's Construction LLC",
      email: "mike@mikesconstruction.com",
      submittedDate: "2024-03-15",
      status: "under_review",
      progress: 75,
      priority: "normal",
      reviewer: "Sarah Johnson",
      estimatedCompletion: "2024-03-22",
      documents: [
        { name: "License Certificate", status: "approved" },
        { name: "Insurance Documentation", status: "approved" },
        { name: "Business Registration", status: "under_review" },
        { name: "References", status: "pending" }
      ],
      notes: "All documentation looks good. Waiting on final reference verification.",
      lastActivity: "2 hours ago"
    },
    {
      id: "APP-2024-002",
      type: "Realtor Verification",
      applicant: "Jennifer Martinez",
      email: "j.martinez@premierrealty.com",
      submittedDate: "2024-03-14",
      status: "approved",
      progress: 100,
      priority: "high",
      reviewer: "David Chen",
      estimatedCompletion: "2024-03-21",
      documents: [
        { name: "MLS Certification", status: "approved" },
        { name: "Brokerage Affiliation", status: "approved" },
        { name: "Professional References", status: "approved" }
      ],
      notes: "Application approved. All requirements met.",
      lastActivity: "1 day ago"
    },
    {
      id: "APP-2024-003",
      type: "Helper Registration",
      applicant: "Carlos Rodriguez",
      email: "carlos.rodriguez@email.com",
      submittedDate: "2024-03-13",
      status: "needs_revision",
      progress: 40,
      priority: "normal",
      reviewer: "Lisa Wang",
      estimatedCompletion: "2024-03-25",
      documents: [
        { name: "Identity Verification", status: "approved" },
        { name: "Address Verification", status: "needs_revision" },
        { name: "Background Check", status: "pending" }
      ],
      notes: "Address verification documents need to be resubmitted with clearer images.",
      lastActivity: "6 hours ago"
    },
    {
      id: "APP-2024-004",
      type: "HOA Leadership Access",
      applicant: "Oakwood Hills Association",
      email: "admin@oakwoodhills.org",
      submittedDate: "2024-03-12",
      status: "pending",
      progress: 25,
      priority: "low",
      reviewer: "Unassigned",
      estimatedCompletion: "2024-03-30",
      documents: [
        { name: "HOA Registration", status: "pending" },
        { name: "Board Authorization", status: "pending" },
        { name: "Financial Documentation", status: "pending" }
      ],
      notes: "Initial application received. Waiting for document uploads.",
      lastActivity: "2 days ago"
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'needs_revision':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'under_review':
        return <Clock className="h-4 w-4 text-blue-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'needs_revision':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'under_review':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-slate-900 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'normal':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-slate-900 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const filteredApplications = activeTab === 'all' 
    ? applications 
    : applications.filter(app => app.status === activeTab);

  return (
	<div className="gradient-bg text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="h-8 w-8 text-orange-400" />
            <h1 className="text-4xl font-bold text-white">Application Tracker</h1>
          </div>
          <p className="text-gray-300 text-lg">
            Monitor and manage all platform applications and verifications
          </p>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Pending Review</p>
                  <p className="text-2xl font-bold text-yellow-400">12</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Under Review</p>
                  <p className="text-2xl font-bold text-blue-400">8</p>
                </div>
                <Eye className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Approved Today</p>
                  <p className="text-2xl font-bold text-green-400">5</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Need Revision</p>
                  <p className="text-2xl font-bold text-red-400">3</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-8">
          <TabsList className="grid w-full grid-cols-6 bg-navy-800/50 backdrop-blur-sm">
            <TabsTrigger value="all" className="data-[state=active]:bg-orange-600">All</TabsTrigger>
            <TabsTrigger value="pending" className="data-[state=active]:bg-orange-600">Pending</TabsTrigger>
            <TabsTrigger value="under_review" className="data-[state=active]:bg-orange-600">Under Review</TabsTrigger>
            <TabsTrigger value="approved" className="data-[state=active]:bg-orange-600">Approved</TabsTrigger>
            <TabsTrigger value="needs_revision" className="data-[state=active]:bg-orange-600">Needs Revision</TabsTrigger>
            <TabsTrigger value="rejected" className="data-[state=active]:bg-orange-600">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Applications List */}
        <div className="space-y-6">
          {filteredApplications.map((application) => (
            <Card key={application.id} className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="text-white">{application.type}</CardTitle>
                      <Badge className={getStatusColor(application.status)}>
                        {getStatusIcon(application.status)}
                        <span className="ml-1 capitalize">{application.status.replace('_', ' ')}</span>
                      </Badge>
                      <Badge className={getPriorityColor(application.priority)}>
                        {application.priority} priority
                      </Badge>
                    </div>
                    <p className="text-gray-400">Application ID: {application.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400 text-sm">Last activity</p>
                    <p className="text-white text-sm">{application.lastActivity}</p>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Applicant Info */}
                  <div>
                    <h4 className="text-white font-medium mb-3">Applicant Information</h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-400">Name: </span>
                        <span className="text-white">{application.applicant}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Email: </span>
                        <span className="text-white">{application.email}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Submitted: </span>
                        <span className="text-white">{new Date(application.submittedDate).toLocaleDateString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Reviewer: </span>
                        <span className="text-white">{application.reviewer}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Est. Completion: </span>
                        <span className="text-white">{new Date(application.estimatedCompletion).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress & Documents */}
                  <div>
                    <h4 className="text-white font-medium mb-3">Progress & Documents</h4>
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">Overall Progress</span>
                        <span className="text-white">{application.progress}%</span>
                      </div>
                      <Progress value={application.progress} className="h-2" />
                    </div>
                    
                    <div className="space-y-2">
                      {application.documents.map((doc, index) => (
                        <div key={index} className="flex justify-between items-center text-sm">
                          <span className="text-gray-300">{doc.name}</span>
                          <Badge variant="outline" className={
                            doc.status === 'approved' ? 'border-green-400 text-green-400' :
                            doc.status === 'needs_revision' ? 'border-yellow-400 text-yellow-400' :
                            doc.status === 'under_review' ? 'border-blue-400 text-blue-400' :
                            'border-gray-400 text-gray-400'
                          }>
                            {doc.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions & Notes */}
                  <div>
                    <h4 className="text-white font-medium mb-3">Actions & Notes</h4>
                    <div className="space-y-3">
                      <div className="bg-navy-700/50 rounded-lg p-3">
                        <p className="text-gray-400 text-xs mb-1">Admin Notes:</p>
                        <p className="text-white text-sm">{application.notes}</p>
                      </div>
                      
                      <div className="space-y-2">
                        <Button className="w-full bg-orange-600 hover:bg-orange-700 text-sm">
                          <Eye className="h-4 w-4 mr-2" />
                          Review Application
                        </Button>
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" size="sm" className="border-orange-600 text-orange-400 hover:bg-orange-600/20">
                            <Download className="h-4 w-4 mr-1" />
                            Documents
                          </Button>
                          <Button variant="outline" size="sm" className="border-orange-600 text-orange-400 hover:bg-orange-600/20">
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Contact
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredApplications.length === 0 && (
          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-white text-lg font-medium mb-2">No applications found</h3>
              <p className="text-gray-400">No applications match the selected filter criteria.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
});

export default ApplicationTracker;