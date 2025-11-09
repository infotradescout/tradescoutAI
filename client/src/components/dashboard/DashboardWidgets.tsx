import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Activity, MessageSquare, Heart, Star, Briefcase, 
  TrendingUp, Users2, Calendar, Bell, Wrench, Link as LinkIcon
} from 'lucide-react';
import { Link } from 'wouter';
import { formatDistanceToNow } from 'date-fns';

interface WidgetProps {
  className?: string;
}

export function ActivityStatsWidget({ className }: WidgetProps) {
  return (
    <Card className={`bg-white dark:bg-slate-800 border-0 shadow-sm ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-orange-500" />
          Your Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">12</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Posts</div>
          </div>
          <div className="text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">48</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Comments</div>
          </div>
          <div className="text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">124</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Likes Received</div>
          </div>
          <div className="text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">5</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Connections</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function RecentProjectsWidget({ className }: WidgetProps) {
  const projects = [
    { id: 1, title: 'Kitchen Remodel', status: 'in_progress', contractor: 'Elite Renovations' },
    { id: 2, title: 'Bathroom Upgrade', status: 'planning', contractor: 'Not assigned' },
  ];

  return (
    <Card className={`bg-white dark:bg-slate-800 border-0 shadow-sm ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-orange-500" />
            My Projects
          </CardTitle>
          <Link href="/projects">
            <Button variant="ghost" size="sm" className="text-xs h-7">View All</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {projects.length === 0 ? (
          <div className="text-center py-6 text-sm text-slate-500 dark:text-slate-400">
            No active projects yet
          </div>
        ) : (
          projects.map((project) => (
            <div key={project.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
              <div className="flex-1">
                <h4 className="font-medium text-sm text-slate-900 dark:text-white">{project.title}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{project.contractor}</p>
              </div>
              <Badge className={project.status === 'in_progress' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}>
                {project.status === 'in_progress' ? 'Active' : 'Planning'}
              </Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function SavedContractorsWidget({ className }: WidgetProps) {
  const savedContractors = [
    { id: 1, name: "Mike's Plumbing", rating: 4.9, specialty: 'Plumbing' },
    { id: 2, name: "Elite Electrical", rating: 4.8, specialty: 'Electrical' },
    { id: 3, name: "Pro Landscaping", rating: 4.7, specialty: 'Landscaping' },
  ];

  return (
    <Card className={`bg-white dark:bg-slate-800 border-0 shadow-sm ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4 text-orange-500" />
            Saved Contractors
          </CardTitle>
          <Link href="/find-contractors">
            <Button variant="ghost" size="sm" className="text-xs h-7">View All</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {savedContractors.map((contractor) => (
          <div key={contractor.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-orange-500 text-white text-xs">
                {contractor.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h4 className="font-medium text-sm text-slate-900 dark:text-white">{contractor.name}</h4>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-xs text-slate-600 dark:text-slate-400">{contractor.rating}</span>
                </div>
                <span className="text-xs text-slate-500">•</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{contractor.specialty}</span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function MessagesPreviewWidget({ className }: WidgetProps) {
  const messages = [
    { id: 1, from: 'Mike Johnson', message: 'When can we schedule the inspection?', time: '2 hours ago' },
    { id: 2, from: 'Elite Renovations', message: 'Your quote is ready for review', time: '1 day ago' },
  ];

  return (
    <Card className={`bg-white dark:bg-slate-800 border-0 shadow-sm ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-orange-500" />
            Recent Messages
          </CardTitle>
          <Link href="/messages">
            <Button variant="ghost" size="sm" className="text-xs h-7">View All</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-6 text-sm text-slate-500 dark:text-slate-400">
            No messages yet
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-medium text-sm text-slate-900 dark:text-white">{msg.from}</h4>
                <span className="text-xs text-slate-500 dark:text-slate-400">{msg.time}</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1">{msg.message}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function QuickActionsWidget({ className }: WidgetProps) {
  const quickActions = [
    { icon: Briefcase, label: 'Post a Project', href: '/projects/new', color: 'text-blue-600' },
    { icon: Wrench, label: 'Find Contractor', href: '/find-contractors', color: 'text-orange-600' },
    { icon: MessageSquare, label: 'Messages', href: '/messages', color: 'text-green-600' },
    { icon: Calendar, label: 'Schedule', href: '/schedule', color: 'text-purple-600' },
  ];

  return (
    <Card className={`bg-white dark:bg-slate-800 border-0 shadow-sm ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map((action, index) => (
            <Link key={index} href={action.href}>
              <button className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors w-full">
                <action.icon className={`h-5 w-5 ${action.color}`} />
                <span className="text-xs font-medium text-slate-900 dark:text-white">{action.label}</span>
              </button>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function NotificationsWidget({ className }: WidgetProps) {
  const notifications = [
    { id: 1, type: 'like', message: 'Someone liked your post', time: '1 hour ago' },
    { id: 2, type: 'comment', message: 'New comment on your project', time: '3 hours ago' },
    { id: 3, type: 'message', message: 'You have a new message', time: '5 hours ago' },
  ];

  return (
    <Card className={`bg-white dark:bg-slate-800 border-0 shadow-sm ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-orange-500" />
            Recent Notifications
          </CardTitle>
          <Link href="/notifications">
            <Button variant="ghost" size="sm" className="text-xs h-7">View All</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {notifications.map((notification) => (
          <div key={notification.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
            <div className={`h-2 w-2 rounded-full mt-2 ${notification.type === 'message' ? 'bg-blue-500' : 'bg-orange-500'}`} />
            <div className="flex-1">
              <p className="text-sm text-slate-900 dark:text-white">{notification.message}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{notification.time}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function CommunityFeedWidget({ className }: WidgetProps) {
  return (
    <Card className={`bg-white dark:bg-slate-800 border-0 shadow-sm ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users2 className="h-4 w-4 text-orange-500" />
            Community Feed
          </CardTitle>
          <Link href="/home">
            <Button variant="ghost" size="sm" className="text-xs h-7">View Full Feed</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
          See what your neighbors are talking about
        </p>
        <Link href="/home">
          <Button className="w-full bg-orange-600 hover:bg-orange-700 text-white" size="sm">
            Go to Feed
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export function AffiliateStatsWidget({ className }: WidgetProps) {
  return (
    <Card className={`bg-white dark:bg-slate-800 border-0 shadow-sm ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-500" />
          Affiliate Earnings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">Total Earned</span>
              <span className="text-2xl font-bold text-green-600">$0.00</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">Pending</span>
              <span className="text-sm text-slate-600 dark:text-slate-400">$0.00</span>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
            <Link href="/affiliate">
              <Button variant="outline" size="sm" className="w-full">
                <LinkIcon className="h-3 w-3 mr-2" />
                Get Your Referral Link
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Widget registry for easy configuration
export const AVAILABLE_WIDGETS = [
  { id: 'activity-stats', name: 'Activity Stats', component: ActivityStatsWidget, defaultEnabled: true },
  { id: 'quick-actions', name: 'Quick Actions', component: QuickActionsWidget, defaultEnabled: true },
  { id: 'recent-projects', name: 'My Projects', component: RecentProjectsWidget, defaultEnabled: true },
  { id: 'saved-contractors', name: 'Saved Contractors', component: SavedContractorsWidget, defaultEnabled: true },
  { id: 'messages-preview', name: 'Recent Messages', component: MessagesPreviewWidget, defaultEnabled: true },
  { id: 'notifications', name: 'Notifications', component: NotificationsWidget, defaultEnabled: false },
  { id: 'community-feed', name: 'Community Feed', component: CommunityFeedWidget, defaultEnabled: false },
  { id: 'affiliate-stats', name: 'Affiliate Earnings', component: AffiliateStatsWidget, defaultEnabled: false },
] as const;
