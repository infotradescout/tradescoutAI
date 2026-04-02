import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { 
  Users, 
  Clock, 
  Phone, 
  Mail,
  Calendar,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Star,
  TrendingUp
} from "lucide-react";

export default function CarSalesFollowUp() {
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const followUpTasks = [
    {
      id: 1,
      customer: "Sarah Johnson",
      type: "Price Follow-up",
      vehicle: "2024 Honda Accord",
      priority: "High",
      dueDate: "Today",
      lastContact: "3 days ago",
      status: "Overdue",
      notes: "Requested lower price - need to check manager approval"
    },
    {
      id: 2,
      customer: "Mike Chen",
      type: "Financing Follow-up", 
      vehicle: "2023 Toyota Camry",
      priority: "High",
      dueDate: "Today",
      lastContact: "2 days ago",
      status: "Due Today",
      notes: "Waiting on bank approval for loan application"
    },
    {
      id: 3,
      customer: "Lisa Rodriguez",
      type: "Test Drive Follow-up",
      vehicle: "2024 Tesla Model Y", 
      priority: "Medium",
      dueDate: "Tomorrow",
      lastContact: "1 day ago",
      status: "Scheduled",
      notes: "Loved the test drive - ready to discuss terms"
    }
  ];

  const recentContacts = [
    {
      id: 1,
      customer: "David Wilson",
      method: "Phone Call",
      duration: "15 minutes",
      outcome: "Scheduled Appointment",
      date: "2 hours ago",
      notes: "Very interested in SUVs, scheduled for tomorrow 11 AM"
    },
    {
      id: 2,
      customer: "Amanda Foster", 
      method: "Email",
      outcome: "Information Sent",
      date: "4 hours ago",
      notes: "Sent brochure and pricing for luxury sedan models"
    }
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "High": return "bg-red-600";
      case "Medium": return "bg-yellow-600";
      case "Low": return "bg-green-600";
      default: return "bg-white/10";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Overdue": return "bg-red-600";
      case "Due Today": return "bg-ts-orange-dark";
      case "Scheduled": return "bg-blue-600";
      case "Completed": return "bg-green-600";
      default: return "bg-white/10";
    }
  };

  return (
    <div className="h-full bg-background">
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-primary/20 rounded-xl">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Customer Follow-Up</h1>
              <p className="text-muted-foreground">Manage customer relationships and follow-up tasks</p>
            </div>
          </div>

          <Tabs defaultValue="tasks" className="space-y-6">
            <TabsList className="bg-muted border border-border">
              <TabsTrigger value="tasks">Follow-Up Tasks</TabsTrigger>
              <TabsTrigger value="contacts">Recent Contacts</TabsTrigger>
              <TabsTrigger value="analytics">Performance</TabsTrigger>
            </TabsList>

            <TabsContent value="tasks" className="space-y-4">
              {followUpTasks.map((task) => (
                <Card key={task.id} className="bg-card border-border">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                          <Users className="h-6 w-6 text-primary" />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg text-foreground">{task.customer}</h3>
                            <Badge className={getPriorityColor(task.priority)}>
                              {task.priority} Priority
                            </Badge>
                            <Badge className={getStatusColor(task.status)}>
                              {task.status}
                            </Badge>
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-6">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <MessageSquare className="h-4 w-4" />
                                {task.type}
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Calendar className="h-4 w-4" />
                                Due: {task.dueDate}
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                Last contact: {task.lastContact}
                              </div>
                            </div>
                            
                            <div className="text-primary font-medium">
                              Vehicle: {task.vehicle}
                            </div>
                          </div>

                          <div className="mt-3 p-3 bg-muted rounded-lg">
                            <p className="text-sm text-muted-foreground">{task.notes}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" data-testid="button-call-customer">
                          <Phone className="h-4 w-4 mr-2" />
                          Call
                        </Button>
                        <Button size="sm" variant="outline" data-testid="button-email-customer">
                          <Mail className="h-4 w-4 mr-2" />
                          Email
                        </Button>
                        <Button size="sm" className="bg-primary hover:bg-primary/90" data-testid="button-complete-task">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Complete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="contacts" className="space-y-4">
              <Card className="bg-card border-border mb-6">
                <CardHeader>
                  <CardTitle>Log New Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button variant="outline" data-testid="button-log-phone">
                      <Phone className="h-4 w-4 mr-2" />
                      Phone Call
                    </Button>
                    <Button variant="outline" data-testid="button-log-email">
                      <Mail className="h-4 w-4 mr-2" />
                      Email
                    </Button>
                    <Button variant="outline" data-testid="button-log-meeting">
                      <Calendar className="h-4 w-4 mr-2" />
                      In-Person
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                {recentContacts.map((contact) => (
                  <Card key={contact.id} className="bg-card border-border">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                            {contact.method === "Phone Call" ? 
                              <Phone className="h-6 w-6 text-primary" /> :
                              <Mail className="h-6 w-6 text-primary" />
                            }
                          </div>
                          
                          <div>
                            <h3 className="font-semibold text-lg mb-1">{contact.customer}</h3>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                              <span>{contact.method}</span>
                              {contact.duration && <span>• {contact.duration}</span>}
                              <span>• {contact.date}</span>
                            </div>
                            
                            <Badge className="bg-green-600 mb-3">
                              {contact.outcome}
                            </Badge>
                            
                            <p className="text-sm text-muted-foreground">{contact.notes}</p>
                          </div>
                        </div>

                        <Button size="sm" variant="outline" data-testid="button-follow-up">
                          Schedule Follow-up
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="analytics">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card className="bg-card border-border">
                  <CardContent className="p-6 text-center">
                    <TrendingUp className="h-8 w-8 text-green-400 mx-auto mb-3" />
                    <p className="text-2xl font-bold text-green-400">73%</p>
                    <p className="text-sm text-muted-foreground">Follow-up Response Rate</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-card border-border">
                  <CardContent className="p-6 text-center">
                    <Star className="h-8 w-8 text-yellow-400 mx-auto mb-3" />
                    <p className="text-2xl font-bold text-yellow-400">4.8</p>
                    <p className="text-sm text-muted-foreground">Customer Satisfaction</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-card border-border">
                  <CardContent className="p-6 text-center">
                    <CheckCircle className="h-8 w-8 text-blue-400 mx-auto mb-3" />
                    <p className="text-2xl font-bold text-blue-400">28</p>
                    <p className="text-sm text-muted-foreground">Tasks Completed This Week</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-card border-border">
                  <CardContent className="p-6 text-center">
                    <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
                    <p className="text-2xl font-bold text-destructive">5</p>
                    <p className="text-sm text-muted-foreground">Overdue Follow-ups</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Follow-up Performance Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 text-sm">
                    <div className="flex justify-between items-center p-3 bg-green-500/10 rounded-lg">
                      <span>Phone calls have highest conversion rate</span>
                      <Badge className="bg-green-600">+23% vs email</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-blue-500/10 rounded-lg">
                      <span>Follow-up within 24 hours improves closing rate</span>
                      <Badge className="bg-blue-600">+45% more likely</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-ts-orange/10 rounded-lg">
                      <span>Average follow-up sequence length</span>
                      <Badge className="bg-ts-orange-dark">3.2 touchpoints</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}