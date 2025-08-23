import { memo, useState } from 'react';
import { Calendar, MapPin, Clock, Users, Plus, Edit, Trash2, Eye, Share2, Star, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EventManagement = memo(function EventManagement() {
  const [activeTab, setActiveTab] = useState("upcoming");
  const [filterCategory, setFilterCategory] = useState("all");

  const events = [
    {
      id: 1,
      title: "Home Improvement Trade Show",
      description: "Annual trade show featuring the latest in home improvement technologies and services",
      date: "2024-04-15",
      time: "9:00 AM - 6:00 PM",
      location: "Los Angeles Convention Center",
      address: "1201 S Figueroa St, Los Angeles, CA 90015",
      category: "Trade Show",
      attendees: 247,
      maxAttendees: 500,
      price: "Free",
      organizer: "TradeScout Events",
      status: "upcoming",
      featured: true,
      image: "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=400&h=250&fit=crop",
      tags: ["networking", "technology", "tools"]
    },
    {
      id: 2,
      title: "Contractor Networking Breakfast",
      description: "Monthly networking event for local contractors to share experiences and opportunities",
      date: "2024-04-08",
      time: "7:30 AM - 9:30 AM",
      location: "Downtown Business Center",
      address: "850 S Broadway, Los Angeles, CA 90014",
      category: "Networking",
      attendees: 34,
      maxAttendees: 50,
      price: "$25",
      organizer: "LA Contractors Guild",
      status: "upcoming",
      featured: false,
      image: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400&h=250&fit=crop",
      tags: ["breakfast", "networking", "business"]
    },
    {
      id: 3,
      title: "Safety Training Workshop",
      description: "OSHA-certified safety training workshop covering construction site safety protocols",
      date: "2024-03-25",
      time: "1:00 PM - 5:00 PM",
      location: "TradeScout Training Center",
      address: "456 Industry Blvd, Los Angeles, CA 90058",
      category: "Training",
      attendees: 89,
      maxAttendees: 100,
      price: "$150",
      organizer: "Safety First Training",
      status: "past",
      featured: false,
      image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=250&fit=crop",
      tags: ["safety", "OSHA", "certification"]
    },
    {
      id: 4,
      title: "Green Building Materials Expo",
      description: "Showcase of sustainable and eco-friendly building materials and practices",
      date: "2024-04-22",
      time: "10:00 AM - 4:00 PM",
      location: "Eco Center Pavilion",
      address: "789 Green Way, Pasadena, CA 91103",
      category: "Expo",
      attendees: 156,
      maxAttendees: 300,
      price: "Free",
      organizer: "Green Building Council",
      status: "upcoming",
      featured: true,
      image: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=250&fit=crop",
      tags: ["sustainability", "green building", "eco-friendly"]
    }
  ];

  const categories = [
    { value: "all", label: "All Categories" },
    { value: "trade-show", label: "Trade Shows" },
    { value: "networking", label: "Networking" },
    { value: "training", label: "Training" },
    { value: "expo", label: "Expos" },
    { value: "workshop", label: "Workshops" }
  ];

  const upcomingEvents = events.filter(event => event.status === 'upcoming');
  const pastEvents = events.filter(event => event.status === 'past');
  const featuredEvents = events.filter(event => event.featured);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
        return 'bg-green-600 hover:bg-green-700';
      case 'past':
        return 'bg-gray-600 hover:bg-gray-700';
      case 'cancelled':
        return 'bg-red-600 hover:bg-red-700';
      default:
        return 'bg-blue-600 hover:bg-blue-700';
    }
  };

  const EventCard = ({ event }: { event: typeof events[0] }) => (
    <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm hover:bg-navy-700/50 transition-colors">
      <div className="relative">
        <img
          src={event.image}
          alt={event.title}
          className="w-full h-48 object-cover rounded-t-lg"
        />
        {event.featured && (
          <div className="absolute top-4 left-4">
            <Badge className="bg-orange-600 hover:bg-orange-700">
              Featured
            </Badge>
          </div>
        )}
        <div className="absolute top-4 right-4">
          <Badge className={getStatusColor(event.status)}>
            {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
          </Badge>
        </div>
      </div>
      
      <CardContent className="p-6">
        <div className="mb-4">
          <h3 className="text-white font-semibold text-lg mb-2">{event.title}</h3>
          <p className="text-gray-400 text-sm mb-3 line-clamp-2">{event.description}</p>
          <Badge variant="outline" className="mb-3">{event.category}</Badge>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-2 text-gray-300 text-sm">
            <Calendar className="h-4 w-4" />
            <span>{new Date(event.date).toLocaleDateString()}</span>
            <Clock className="h-4 w-4 ml-2" />
            <span>{event.time}</span>
          </div>
          
          <div className="flex items-center gap-2 text-gray-300 text-sm">
            <MapPin className="h-4 w-4" />
            <span>{event.location}</span>
          </div>

          <div className="flex items-center gap-2 text-gray-300 text-sm">
            <Users className="h-4 w-4" />
            <span>{event.attendees} / {event.maxAttendees} attendees</span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <span className="text-orange-400 font-bold text-lg">{event.price}</span>
          <span className="text-gray-400 text-sm">by {event.organizer}</span>
        </div>

        <div className="mb-4">
          <div className="flex flex-wrap gap-1">
            {event.tags.map((tag, index) => (
              <span key={index} className="text-orange-400 text-xs hover:text-orange-300 cursor-pointer">
                #{tag}
              </span>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button className="flex-1 bg-orange-600 hover:bg-orange-700">
            {event.status === 'upcoming' ? 'Register' : 'View Details'}
          </Button>
          <Button size="sm" variant="outline" className="border-orange-600 text-orange-400 hover:bg-orange-600/20">
            <Share2 className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" className="border-orange-600 text-orange-400 hover:bg-orange-600/20">
            <Star className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen gradient-bg text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Calendar className="h-8 w-8 text-orange-400" />
                <h1 className="text-4xl font-bold text-white">Event Management</h1>
              </div>
              <p className="text-gray-300 text-lg">
                Discover and manage industry events, workshops, and networking opportunities
              </p>
            </div>
            
            <Button className="bg-orange-600 hover:bg-orange-700">
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <Calendar className="h-8 w-8 text-orange-400 mx-auto mb-3" />
              <div className="text-2xl font-bold text-white mb-1">{upcomingEvents.length}</div>
              <div className="text-gray-400 text-sm">Upcoming Events</div>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <Users className="h-8 w-8 text-blue-400 mx-auto mb-3" />
              <div className="text-2xl font-bold text-white mb-1">847</div>
              <div className="text-gray-400 text-sm">Total Attendees</div>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <Star className="h-8 w-8 text-yellow-400 mx-auto mb-3" />
              <div className="text-2xl font-bold text-white mb-1">{featuredEvents.length}</div>
              <div className="text-gray-400 text-sm">Featured Events</div>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <MapPin className="h-8 w-8 text-green-400 mx-auto mb-3" />
              <div className="text-2xl font-bold text-white mb-1">15</div>
              <div className="text-gray-400 text-sm">Cities</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm mb-8">
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <span className="text-gray-400">Filter by:</span>
              </div>
              
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="bg-navy-700 border-navy-600 text-white w-48">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="Search events..."
                className="bg-navy-700 border-navy-600 text-white w-64"
              />

              <Button variant="outline" className="border-orange-600 text-orange-400 hover:bg-orange-600/20">
                Advanced Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Events Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-navy-800/50 backdrop-blur-sm">
            <TabsTrigger value="upcoming" className="data-[state=active]:bg-orange-600">
              Upcoming ({upcomingEvents.length})
            </TabsTrigger>
            <TabsTrigger value="featured" className="data-[state=active]:bg-orange-600">
              Featured ({featuredEvents.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="data-[state=active]:bg-orange-600">
              Past Events ({pastEvents.length})
            </TabsTrigger>
            <TabsTrigger value="my-events" className="data-[state=active]:bg-orange-600">
              My Events (3)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="featured" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="past" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pastEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="my-events" className="mt-6">
            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white">My Created Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {events.slice(0, 2).map((event) => (
                    <div key={event.id} className="p-4 bg-navy-700/50 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="text-white font-medium mb-1">{event.title}</h4>
                          <p className="text-gray-400 text-sm mb-2">{event.description}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-400">
                            <span>{new Date(event.date).toLocaleDateString()}</span>
                            <span>{event.attendees} attendees</span>
                            <Badge className={getStatusColor(event.status)}>
                              {event.status}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="border-navy-600 text-gray-400 hover:bg-navy-600/50">
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" className="border-orange-600 text-orange-400 hover:bg-orange-600/20">
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" className="border-red-600 text-red-400 hover:bg-red-600/20">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <Button className="w-full mt-6 bg-orange-600 hover:bg-orange-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Event
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
});

export default EventManagement;