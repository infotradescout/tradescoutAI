import { memo, useState } from 'react';
import { Shield, Flag, Eye, EyeOff, Trash2, CheckCircle2, XCircle, MessageSquare, Users2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

const ContentModeration = memo(function ContentModeration() {
  const [activeTab, setActiveTab] = useState("flagged");
  const { toast } = useToast();

  const flaggedContent = [
    {
      id: 1,
      type: "post",
      content: "Looking for recommendations for a roofing contractor in Beverly Hills. Need someone reliable and affordable for a complete roof replacement.",
      author: {
        name: "Jennifer Smith",
        avatar: "https://images.unsplash.com/photo-1494790108755-2616b612d76c?w=40&h=40&fit=crop&crop=face",
        role: "homeowner",
        verified: true
      },
      flaggedBy: 3,
      flagReasons: ["spam", "inappropriate"],
      flaggedDate: "2024-03-20T10:30:00Z",
      status: "pending",
      priority: "medium"
    },
    {
      id: 2,
      type: "comment",
      content: "I can do this job for half the price! Contact me directly at cheapwork@email.com",
      author: {
        name: "Bob Wilson",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face",
        role: "contractor",
        verified: false
      },
      flaggedBy: 8,
      flagReasons: ["spam", "solicitation"],
      flaggedDate: "2024-03-20T09:15:00Z",
      status: "pending",
      priority: "high"
    }
  ];

  const reports = [
    {
      id: 1,
      reportedUser: "Mike Johnson",
      reportedBy: "Sarah Davis",
      reason: "Harassment",
      description: "User has been sending inappropriate messages through the platform chat system.",
      date: "2024-03-19T14:20:00Z",
      status: "investigating"
    },
    {
      id: 2,
      reportedUser: "Quick Fix LLC",
      reportedBy: "Tom Wilson",
      reason: "False advertising",
      description: "Company claiming to be licensed when they are not verified on the platform.",
      date: "2024-03-19T11:45:00Z",
      status: "resolved"
    }
  ];

  const handleApproveContent = (contentId: number) => {
    toast({
      title: "Content Approved",
      description: "The flagged content has been approved and is now visible.",
    });
  };

  const handleRemoveContent = (contentId: number) => {
    toast({
      title: "Content Removed",
      description: "The flagged content has been removed from the platform.",
      variant: "destructive",
    });
  };

  const handleHideContent = (contentId: number) => {
    toast({
      title: "Content Hidden",
      description: "The content has been hidden from public view.",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-600';
      case 'approved':
        return 'bg-green-600';
      case 'removed':
        return 'bg-red-600';
      case 'investigating':
        return 'bg-blue-600';
      case 'resolved':
        return 'bg-gray-600';
      default:
        return 'bg-gray-600';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-400 border-red-600';
      case 'medium':
        return 'text-yellow-400 border-yellow-600';
      case 'low':
        return 'text-green-400 border-green-600';
      default:
        return 'text-gray-400 border-gray-600';
    }
  };

  return (
    <div className="text-foreground">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold text-foreground">Content Moderation</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Monitor and moderate platform content to maintain community standards
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-card border-border backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Flagged Content</p>
                  <p className="text-2xl font-bold text-card-foreground">{flaggedContent.length}</p>
                </div>
                <Flag className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">User Reports</p>
                  <p className="text-2xl font-bold text-card-foreground">{reports.length}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Resolved Today</p>
                  <p className="text-2xl font-bold text-card-foreground">18</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Response Time</p>
                  <p className="text-2xl font-bold text-card-foreground">1.2h</p>
                </div>
                <Eye className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Moderation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted border-border">
            <TabsTrigger value="flagged" className="data-[state=active]:bg-background">
              Flagged Content ({flaggedContent.length})
            </TabsTrigger>
            <TabsTrigger value="reports" className="data-[state=active]:bg-background">
              User Reports ({reports.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-background">
              Moderation History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="flagged" className="space-y-6">
            {flaggedContent.map((item) => (
              <Card key={item.id} className="bg-card border-border backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={getPriorityColor(item.priority)}>
                        {item.priority.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="border-border text-muted-foreground">
                        {item.type.toUpperCase()}
                      </Badge>
                      <span className="text-muted-foreground text-sm">
                        Flagged by {item.flaggedBy} users
                      </span>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(item.status)}`}></div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Content */}
                    <div className="lg:col-span-2 space-y-4">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={item.author.avatar} />
                          <AvatarFallback>{item.author.name[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-foreground">{item.author.name}</span>
                            <Badge variant="outline" className="border-blue-500 text-blue-500">
                              {item.author.role}
                            </Badge>
                            {item.author.verified && (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                          <div className="bg-muted p-4 rounded-lg">
                            <p className="text-foreground">{item.content}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm">Flag reasons:</span>
                        {item.flagReasons.map((reason, index) => (
                          <Badge key={index} variant="outline" className="border-destructive text-destructive">
                            {reason}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-4">
                      <h4 className="text-foreground font-medium">Moderation Actions</h4>
                      <div className="space-y-3">
                        <Button 
                          className="w-full bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleApproveContent(item.id)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Approve Content
                        </Button>
                        <Button 
                          variant="outline" 
                          className="w-full border-yellow-500 text-yellow-600 hover:bg-yellow-50"
                          onClick={() => handleHideContent(item.id)}
                        >
                          <EyeOff className="h-4 w-4 mr-2" />
                          Hide Content
                        </Button>
                        <Button 
                          variant="outline" 
                          className="w-full border-destructive text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveContent(item.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove Content
                        </Button>
                      </div>

                      <div className="mt-4">
                        <h5 className="text-foreground font-medium mb-2">Moderation Notes</h5>
                        <Textarea 
                          placeholder="Add moderation notes..."
                          className="bg-background border-input text-foreground"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            {reports.map((report) => (
              <Card key={report.id} className="bg-card border-border backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-foreground font-medium">{report.reason}</h3>
                      <p className="text-muted-foreground text-sm">
                        {report.reportedUser} reported by {report.reportedBy}
                      </p>
                    </div>
                    <Badge variant="outline" className={`${getStatusColor(report.status)} text-white`}>
                      {report.status.toUpperCase()}
                    </Badge>
                  </div>
                  
                  <p className="text-muted-foreground mb-4">{report.description}</p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      Reported on {new Date(report.date).toLocaleDateString()}
                    </span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="border-primary text-primary hover:bg-primary/10">
                        <Users2 className="h-4 w-4 mr-1" />
                        View User
                      </Button>
                      <Button size="sm" variant="outline" className="border-primary text-primary hover:bg-primary/10">
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Contact
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <div className="text-center py-12">
              <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-foreground text-xl mb-2">Moderation History</h3>
              <p className="text-muted-foreground">View complete history of moderation actions and decisions</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
});

export default ContentModeration;