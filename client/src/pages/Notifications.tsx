import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NotificationPreferences } from '@/components/ui/notification-preferences';
import { PersonalEventsManager } from '@/components/ui/personal-events-manager';
import {
  Bell,
  Calendar,
  Settings,
  Gift,
  Sparkles,
  MessageCircle,
  TrendingUp,
  Award,
  Clock,
  History,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function NotificationsPage() {
  const { user } = useAuth();
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  // Fetch notification stats
  const { data: stats } = useQuery({
    queryKey: ['/api/notifications/stats'],
  });

  const { data: recentNotifications = [] } = useQuery({
    queryKey: ['/api/notifications?limit=5'],
  });

  const statsCards = [
    {
      title: 'Total Notifications',
      value: stats?.total || 0,
      icon: Bell,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'This Week',
      value: stats?.thisWeek || 0,
      icon: TrendingUp,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Personal Events',
      value: stats?.personalEvents || 0,
      icon: Calendar,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Unread',
      value: stats?.unread || 0,
      icon: MessageCircle,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-navy-900 to-navy-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Bell className="h-6 w-6 text-orange-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Notifications</h1>
              <p className="text-gray-400">
                Manage your notification preferences and personal events
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => setPreferencesOpen(true)}
              className="bg-orange-500 text-white hover:bg-orange-600"
            >
              <Settings className="h-4 w-4 mr-2" />
              Notification Settings
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statsCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="bg-navy-800/50 border-navy-600">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-400">{stat.title}</p>
                      <p className="text-2xl font-bold text-white">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-full ${stat.bgColor}`}>
                      <Icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main Content */}
        <Tabs defaultValue="events" className="space-y-6">
          <TabsList className="bg-navy-800/50 border border-navy-600">
            <TabsTrigger value="events" className="text-gray-300 data-[state=active]:text-white data-[state=active]:bg-orange-500">
              <Gift className="h-4 w-4 mr-2" />
              Personal Events
            </TabsTrigger>
            <TabsTrigger value="history" className="text-gray-300 data-[state=active]:text-white data-[state=active]:bg-orange-500">
              <History className="h-4 w-4 mr-2" />
              Recent Notifications
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-gray-300 data-[state=active]:text-white data-[state=active]:bg-orange-500">
              <Settings className="h-4 w-4 mr-2" />
              Advanced Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="events" className="space-y-6">
            <Card className="bg-navy-800/50 border-navy-600">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-orange-400" />
                  <div>
                    <CardTitle className="text-white">Personal Events & Reminders</CardTitle>
                    <CardDescription className="text-gray-400">
                      Add birthdays, anniversaries, and other important dates you want to remember
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <PersonalEventsManager />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card className="bg-navy-800/50 border-navy-600">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <History className="h-5 w-5 text-orange-400" />
                  <div>
                    <CardTitle className="text-white">Recent Notifications</CardTitle>
                    <CardDescription className="text-gray-400">
                      Your latest notification activity
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {recentNotifications.length === 0 ? (
                  <div className="text-center py-8">
                    <Bell className="h-12 w-12 mx-auto text-gray-500 mb-4" />
                    <p className="text-gray-400">No recent notifications</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentNotifications.map((notification: any) => (
                      <div
                        key={notification.id}
                        className="flex items-start gap-3 p-4 rounded-lg bg-navy-700/30 border border-navy-600/50"
                      >
                        <div className="flex-shrink-0">
                          {notification.iconName === 'gift' ? (
                            <Gift className="h-5 w-5 text-pink-400" />
                          ) : notification.iconName === 'award' ? (
                            <Award className="h-5 w-5 text-yellow-400" />
                          ) : notification.iconName === 'sparkles' ? (
                            <Sparkles className="h-5 w-5 text-purple-400" />
                          ) : (
                            <Bell className="h-5 w-5 text-blue-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-white font-medium">{notification.title}</h4>
                          <p className="text-gray-400 text-sm mt-1">{notification.message}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Clock className="h-3 w-3 text-gray-500" />
                            <span className="text-xs text-gray-500">
                              {new Date(notification.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card className="bg-navy-800/50 border-navy-600">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Settings className="h-5 w-5 text-orange-400" />
                  <div>
                    <CardTitle className="text-white">Advanced Settings</CardTitle>
                    <CardDescription className="text-gray-400">
                      Configure detailed notification preferences
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Notification Types Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-navy-700/30 border border-navy-600/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Gift className="h-4 w-4 text-pink-400" />
                        <span className="text-white font-medium">Birthday Reminders</span>
                      </div>
                      <p className="text-gray-400 text-sm">
                        Get notified about upcoming birthdays and anniversaries
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-navy-700/30 border border-navy-600/50">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageCircle className="h-4 w-4 text-blue-400" />
                        <span className="text-white font-medium">Messages</span>
                      </div>
                      <p className="text-gray-400 text-sm">
                        New chat messages and conversations
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-navy-700/30 border border-navy-600/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Award className="h-4 w-4 text-yellow-400" />
                        <span className="text-white font-medium">Achievements</span>
                      </div>
                      <p className="text-gray-400 text-sm">
                        Milestones, reviews, and accomplishments
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={() => setPreferencesOpen(true)}
                    className="bg-orange-500 text-white hover:bg-orange-600"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Open Detailed Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Notification Preferences Dialog */}
      <NotificationPreferences
        open={preferencesOpen}
        onOpenChange={setPreferencesOpen}
      />
    </div>
  );
}