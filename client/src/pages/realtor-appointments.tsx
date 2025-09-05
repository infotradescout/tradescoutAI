import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar, 
  Clock, 
  User, 
  Home,
  Phone,
  Mail,
  MapPin,
  Plus,
  Edit,
  CheckCircle,
  Eye
} from "lucide-react";

export default function RealtorAppointments() {
  const [selectedDate] = useState(new Date().toISOString().split('T')[0]);

  const todayAppointments = [
    {
      id: 1,
      client: "Sarah & John Martinez",
      email: "smartinez@email.com",
      phone: "(555) 123-4567",
      time: "10:00 AM",
      duration: "90 minutes",
      type: "Listing Presentation",
      property: "456 Oak Street, Downtown",
      status: "Confirmed",
      notes: "Bring market analysis and staging recommendations"
    },
    {
      id: 2,
      client: "David Chen", 
      email: "dchen@email.com",
      phone: "(555) 234-5678",
      time: "2:30 PM",
      duration: "60 minutes",
      type: "Property Showing",
      property: "789 Maple Ave, Riverside",
      status: "Confirmed",
      notes: "First-time buyers, interested in schools nearby"
    },
    {
      id: 3,
      client: "Amanda Foster",
      email: "afoster@email.com", 
      phone: "(555) 345-6789",
      time: "4:00 PM",
      duration: "45 minutes",
      type: "Contract Review",
      property: "123 Pine Drive, Suburban",
      status: "Pending",
      notes: "Review inspection contingencies"
    }
  ];

  const upcomingAppointments = [
    {
      id: 4,
      client: "Michael Wilson",
      date: "Tomorrow",
      time: "11:00 AM",
      type: "Buyer Consultation",
      property: "Initial meeting - no specific property",
      status: "Confirmed"
    },
    {
      id: 5, 
      client: "Lisa Rodriguez",
      date: "Friday",
      time: "3:00 PM", 
      type: "Open House Prep",
      property: "567 Elm Street, Downtown",
      status: "Confirmed"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Confirmed": return "bg-green-600";
      case "Pending": return "bg-yellow-600";
      case "Completed": return "bg-blue-600";
      case "Cancelled": return "bg-red-600";
      default: return "bg-gray-600";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "Property Showing": return <Home className="h-4 w-4" />;
      case "Listing Presentation": return <Eye className="h-4 w-4" />;
      case "Contract Review": return <CheckCircle className="h-4 w-4" />;
      case "Buyer Consultation": return <User className="h-4 w-4" />;
      case "Open House Prep": return <Home className="h-4 w-4" />;
      default: return <Calendar className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <Calendar className="h-8 w-8 text-blue-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Appointments</h1>
                <p className="text-gray-400">Manage showings, consultations, and meetings</p>
              </div>
            </div>
            
            <Button className="bg-blue-600 hover:bg-blue-700" data-testid="button-new-appointment">
              <Plus className="h-4 w-4 mr-2" />
              Schedule Appointment
            </Button>
          </div>

          <Tabs defaultValue="today" className="space-y-6">
            <TabsList className="bg-navy-800/50 border border-navy-600">
              <TabsTrigger value="today">Today's Schedule</TabsTrigger>
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="calendar">Calendar View</TabsTrigger>
            </TabsList>

            <TabsContent value="today" className="space-y-4">
              {todayAppointments.map((appointment) => (
                <Card key={appointment.id} className="bg-navy-800/50 border-navy-600">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                          {getTypeIcon(appointment.type)}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{appointment.client}</h3>
                            <Badge className={getStatusColor(appointment.status)}>
                              {appointment.status}
                            </Badge>
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-6">
                              <div className="flex items-center gap-2 text-gray-400">
                                <Clock className="h-4 w-4" />
                                {appointment.time} ({appointment.duration})
                              </div>
                              <div className="flex items-center gap-2 text-gray-400">
                                <Calendar className="h-4 w-4" />
                                {appointment.type}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-6">
                              <div className="flex items-center gap-2 text-gray-400">
                                <Mail className="h-4 w-4" />
                                {appointment.email}
                              </div>
                              <div className="flex items-center gap-2 text-gray-400">
                                <Phone className="h-4 w-4" />
                                {appointment.phone}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-blue-400">
                              <Home className="h-4 w-4" />
                              {appointment.property}
                            </div>
                          </div>

                          {appointment.notes && (
                            <div className="mt-3 p-3 bg-navy-700/30 rounded-lg">
                              <p className="text-sm text-gray-300">{appointment.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" data-testid="button-edit-appointment">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" data-testid="button-start-appointment">
                          Start Meeting
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {todayAppointments.length === 0 && (
                <Card className="bg-navy-800/50 border-navy-600">
                  <CardContent className="p-8 text-center">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Appointments Today</h3>
                    <p className="text-gray-400 mb-4">Your schedule is clear for today</p>
                    <Button className="bg-blue-600 hover:bg-blue-700" data-testid="button-schedule-appointment">
                      <Plus className="h-4 w-4 mr-2" />
                      Schedule New Appointment
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="upcoming" className="space-y-4">
              {upcomingAppointments.map((appointment) => (
                <Card key={appointment.id} className="bg-navy-800/50 border-navy-600">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                          {getTypeIcon(appointment.type)}
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{appointment.client}</h3>
                            <Badge className={getStatusColor(appointment.status)}>
                              {appointment.status}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-6 text-sm text-gray-400 mb-2">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              {appointment.date}
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              {appointment.time}
                            </div>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              {appointment.type}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-blue-400">
                            <Home className="h-4 w-4" />
                            {appointment.property}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" data-testid="button-reschedule">
                          <Calendar className="h-4 w-4 mr-2" />
                          Reschedule
                        </Button>
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" data-testid="button-view-details">
                          View Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="calendar">
              <Card className="bg-navy-800/50 border-navy-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-400" />
                    Calendar Integration
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8 text-center">
                  <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Calendar View</h3>
                  <p className="text-gray-400 mb-6">
                    Full calendar view with Google Calendar and Outlook sync coming soon
                  </p>
                  <Button variant="outline" data-testid="button-setup-calendar">
                    <Calendar className="h-4 w-4 mr-2" />
                    Set Up Calendar Sync
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}