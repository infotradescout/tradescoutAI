import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  Clock,
  User,
  Car,
  Phone,
  Mail,
  Plus,
  Edit,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

export default function CarSalesAppointments() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  const todayAppointments = [
    {
      id: 1,
      customer: "Sarah Johnson",
      email: "sarah.j@email.com",
      phone: "(555) 123-4567",
      time: "10:00 AM",
      duration: "60 minutes",
      type: "Test Drive",
      vehicle: "2024 Honda Accord",
      status: "Confirmed",
      notes: "Interested in financing options",
    },
    {
      id: 2,
      customer: "Mike Chen",
      email: "mchen@email.com",
      phone: "(555) 234-5678",
      time: "2:00 PM",
      duration: "45 minutes",
      type: "Vehicle Inspection",
      vehicle: "2023 Toyota Camry",
      status: "Pending",
      notes: "Bringing trade-in vehicle",
    },
    {
      id: 3,
      customer: "Lisa Rodriguez",
      email: "lisa.r@email.com",
      phone: "(555) 345-6789",
      time: "4:30 PM",
      duration: "90 minutes",
      type: "Purchase Discussion",
      vehicle: "2024 Tesla Model Y",
      status: "Confirmed",
      notes: "Ready to finalize purchase",
    },
  ];

  const upcomingAppointments = [
    {
      id: 4,
      customer: "David Wilson",
      date: "Tomorrow",
      time: "11:00 AM",
      type: "First Meeting",
      vehicle: "TBD - Looking for SUV",
      status: "Confirmed",
    },
    {
      id: 5,
      customer: "Amanda Foster",
      date: "Friday",
      time: "3:00 PM",
      type: "Test Drive",
      vehicle: "2024 BMW X5",
      status: "Pending",
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Confirmed":
        return "bg-green-600";
      case "Pending":
        return "bg-yellow-600";
      case "Completed":
        return "bg-primary";
      default:
        return "bg-muted";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "Test Drive":
        return <Car className="h-4 w-4" />;
      case "Vehicle Inspection":
        return <CheckCircle className="h-4 w-4" />;
      case "Purchase Discussion":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Calendar className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Appointments</h1>
              <p className="text-muted-foreground">Manage customer meetings and test drives</p>
            </div>
          </div>

          <Button className="bg-primary hover:bg-primary/90" data-testid="button-new-appointment">
            <Plus className="h-4 w-4 mr-2" />
            New Appointment
          </Button>
        </div>

        <Tabs defaultValue="today" className="space-y-6">
          <TabsList className="bg-muted border border-border">
            <TabsTrigger value="today">Today's Schedule</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="calendar">Calendar View</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="space-y-4">
            <div className="space-y-4">
              {todayAppointments.map((appointment) => (
                <Card key={appointment.id} className="bg-card border-border">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                          <div className="text-primary">{getTypeIcon(appointment.type)}</div>
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg text-foreground">
                              {appointment.customer}
                            </h3>
                            <Badge className={getStatusColor(appointment.status)}>
                              {appointment.status}
                            </Badge>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                {appointment.time} ({appointment.duration})
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Car className="h-4 w-4 text-primary" />
                                {appointment.vehicle}
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Mail className="h-4 w-4" />
                                {appointment.email}
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Phone className="h-4 w-4" />
                                {appointment.phone}
                              </div>
                            </div>
                          </div>

                          {appointment.notes && (
                            <div className="mt-3 p-3 bg-muted rounded-lg">
                              <p className="text-sm text-muted-foreground">{appointment.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" data-testid="button-edit-appointment">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          className="bg-primary hover:bg-primary/90"
                          data-testid="button-start-appointment"
                        >
                          Start Meeting
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {todayAppointments.length === 0 && (
                <Card className="bg-card border-border">
                  <CardContent className="p-8 text-center">
                    <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2 text-foreground">
                      No Appointments Today
                    </h3>
                    <p className="text-muted-foreground mb-4">Your schedule is clear for today</p>
                    <Button
                      className="bg-primary hover:bg-primary/90"
                      data-testid="button-schedule-appointment"
                    >
                      Schedule New Appointment
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="upcoming" className="space-y-4">
            <div className="space-y-4">
              {upcomingAppointments.map((appointment) => (
                <Card key={appointment.id} className="bg-card border-border">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                          <div className="text-primary">{getTypeIcon(appointment.type)}</div>
                        </div>

                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg text-foreground">
                              {appointment.customer}
                            </h3>
                            <Badge className={getStatusColor(appointment.status)}>
                              {appointment.status}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-6 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              {appointment.date}
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              {appointment.time}
                            </div>
                            <div className="flex items-center gap-2">
                              <Car className="h-4 w-4 text-primary" />
                              {appointment.vehicle}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" data-testid="button-reschedule">
                          <Calendar className="h-4 w-4 mr-2" />
                          Reschedule
                        </Button>
                        <Button
                          size="sm"
                          className="bg-primary hover:bg-primary/90"
                          data-testid="button-view-details"
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="calendar">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Calendar className="h-5 w-5 text-primary" />
                  Calendar View
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 text-center">
                <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-foreground">Calendar Integration</h3>
                <p className="text-muted-foreground mb-6">
                  Full calendar view coming soon. Sync with Google Calendar, Outlook, and other
                  calendar services.
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
  );
}
