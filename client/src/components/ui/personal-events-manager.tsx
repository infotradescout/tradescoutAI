import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Calendar,
  Gift,
  Award,
  Plus,
  Edit,
  Trash2,
  Bell,
  BellOff,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface PersonalEvent {
  id: string;
  eventType: string;
  eventName?: string;
  eventDate: string; // MM-DD format
  eventYear?: number;
  enableNotifications: boolean;
  notifyDaysBefore: number[];
  customMessage?: string;
  isPublic: boolean;
  shareWithTeam: boolean;
  createdAt: string;
}

const eventSchema = z.object({
  eventType: z.string().min(1, 'Event type is required'),
  eventName: z.string().optional(),
  eventDate: z.string().min(1, 'Event date is required'),
  eventYear: z.number().optional(),
  enableNotifications: z.boolean(),
  notifyDaysBefore: z.array(z.number()),
  customMessage: z.string().optional(),
  isPublic: z.boolean(),
  shareWithTeam: z.boolean(),
});

type EventForm = z.infer<typeof eventSchema>;

const eventTypes = [
  { value: 'birthday', label: 'Birthday', icon: Gift, color: 'text-pink-500' },
  { value: 'work_anniversary', label: 'Work Anniversary', icon: Award, color: 'text-blue-500' },
  { value: 'business_anniversary', label: 'Business Anniversary', icon: Award, color: 'text-green-500' },
  { value: 'custom', label: 'Custom Event', icon: Calendar, color: 'text-purple-500' },
];

const reminderOptions = [
  { value: 0, label: 'On the day' },
  { value: 1, label: '1 day before' },
  { value: 7, label: '1 week before' },
  { value: 14, label: '2 weeks before' },
  { value: 30, label: '1 month before' },
];

export function PersonalEventsManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PersonalEvent | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch events
  const { data: events = [], isLoading } = useQuery<PersonalEvent[]>({
    queryKey: ['/api/notifications/personal-events'],
    placeholderData: [] as PersonalEvent[],
  });

  const form = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      eventType: 'birthday',
      enableNotifications: true,
      notifyDaysBefore: [0, 1, 7],
      isPublic: false,
      shareWithTeam: false,
    },
  });

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: (data: EventForm) => 
      apiRequest('/api/notifications/personal-events', {
        method: 'POST',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/personal-events'] });
      toast({
        title: 'Event Added',
        description: 'Your personal event has been saved.',
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add event',
        variant: 'destructive',
      });
    },
  });

  // Update event mutation
  const updateEventMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<EventForm> }) => 
      apiRequest(`/api/notifications/personal-events/${id}`, {
        method: 'PUT',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/personal-events'] });
      toast({
        title: 'Event Updated',
        description: 'Your personal event has been updated.',
      });
      setEditingEvent(null);
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update event',
        variant: 'destructive',
      });
    },
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: (id: string) => 
      apiRequest(`/api/notifications/personal-events/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/personal-events'] });
      toast({
        title: 'Event Deleted',
        description: 'Your personal event has been deleted.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete event',
        variant: 'destructive',
      });
    },
  });

  const handleOpenDialog = (event?: PersonalEvent) => {
    if (event) {
      setEditingEvent(event);
      form.reset({
        eventType: event.eventType,
        eventName: event.eventName || '',
        eventDate: event.eventDate,
        eventYear: event.eventYear || undefined,
        enableNotifications: event.enableNotifications,
        notifyDaysBefore: event.notifyDaysBefore ?? [],
        customMessage: event.customMessage || '',
        isPublic: event.isPublic,
        shareWithTeam: event.shareWithTeam,
      });
    } else {
      setEditingEvent(null);
      form.reset();
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: EventForm) => {
    if (editingEvent) {
      updateEventMutation.mutate({ id: editingEvent.id, data });
    } else {
      createEventMutation.mutate(data);
    }
  };

  const formatEventDate = (dateStr: string, year?: number) => {
    const [month, day] = dateStr.split('-');
    const currentYear = year || new Date().getFullYear();
    const date = new Date(currentYear, parseInt(month) - 1, parseInt(day));
    return format(date, year ? 'MMMM d, yyyy' : 'MMMM d');
  };

  const getEventTypeInfo = (type: string) => {
    return eventTypes.find(t => t.value === type) || eventTypes[0];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Personal Events</h2>
          <p className="text-white/60">
            Manage your birthdays, anniversaries, and other important dates.
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => handleOpenDialog()}
              className="bg-ts-orange text-white hover:bg-ts-orange-dark"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Event
            </Button>
          </DialogTrigger>
          
          <DialogContent className="sm:max-w-[500px] bg-tsCard border-white/10">
            <DialogHeader>
              <DialogTitle className="text-white">
                {editingEvent ? 'Edit Event' : 'Add Personal Event'}
              </DialogTitle>
              <DialogDescription className="text-white/60">
                Add important dates you'd like to be reminded about.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="eventType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Event Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-tsCard border-white/10 text-white">
                            <SelectValue placeholder="Select event type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-tsCard border-white/10">
                          {eventTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                <type.icon className={`h-4 w-4 ${type.color}`} />
                                {type.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch('eventType') === 'custom' && (
                  <FormField
                    control={form.control}
                    name="eventName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Event Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Enter custom event name"
                            className="bg-tsCard border-white/10 text-white"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="eventDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Date (MM-DD)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="12-25"
                            pattern="\d{2}-\d{2}"
                            className="bg-tsCard border-white/10 text-white"
                          />
                        </FormControl>
                        <FormDescription className="text-white/60 text-xs">
                          Format: MM-DD (e.g., 12-25 for Dec 25)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="eventYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Year (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            placeholder="2023"
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                            className="bg-tsCard border-white/10 text-white"
                          />
                        </FormControl>
                        <FormDescription className="text-white/60 text-xs">
                          For calculating age/years
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="enableNotifications"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border border-white/10 p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-white">Enable Notifications</FormLabel>
                        <FormDescription className="text-white/60 text-sm">
                          Receive reminders for this event
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {form.watch('enableNotifications') && (
                  <FormField
                    control={form.control}
                    name="notifyDaysBefore"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Reminder Schedule</FormLabel>
                        <div className="flex flex-wrap gap-2">
                          {reminderOptions.map((option) => {
                            const isSelected = field.value.includes(option.value);
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  const newValue = isSelected
                                    ? field.value.filter(v => v !== option.value)
                                    : [...field.value, option.value].sort((a, b) => a - b);
                                  field.onChange(newValue);
                                }}
                                className={`px-3 py-1 rounded-full text-xs transition-colors ${
                                  isSelected
                                    ? 'bg-ts-orange text-black'
                                    : 'bg-tsCard text-white/70 border border-white/10'
                                }`}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                        <FormDescription className="text-white/60 text-xs">
                          Select when you want to be reminded
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="customMessage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Custom Message (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Enter a custom notification message"
                          className="bg-tsCard border-white/10 text-white"
                        />
                      </FormControl>
                      <FormDescription className="text-white/60 text-xs">
                        Override the default notification message
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    className="border-white/10 text-white hover:bg-tsCard"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createEventMutation.isPending || updateEventMutation.isPending}
                    className="bg-ts-orange text-white hover:bg-ts-orange-dark"
                  >
                    {editingEvent ? 'Update Event' : 'Add Event'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Events List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 mx-auto text-white/60 mb-4" />
            <p className="text-white/60">Loading your events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 mx-auto text-white/60 mb-4" />
            <p className="text-white/60 mb-4">No personal events added yet.</p>
            <Button
              onClick={() => handleOpenDialog()}
              className="bg-ts-orange text-white hover:bg-ts-orange-dark"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Event
            </Button>
          </div>
        ) : (
          Array.isArray(events) ? events.map((event: PersonalEvent) => {
            const typeInfo = getEventTypeInfo(event.eventType);
            const TypeIcon = typeInfo.icon;
            const reminders = event.notifyDaysBefore ?? [];
            
            return (
              <div
                key={event.id}
                className="bg-tsCard/50 rounded-lg border border-white/10 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <TypeIcon className={`h-5 w-5 mt-0.5 ${typeInfo.color}`} />
                    <div>
                      <h3 className="text-white font-medium">
                        {event.eventName || typeInfo.label}
                      </h3>
                      <p className="text-white/60 text-sm">
                        {formatEventDate(event.eventDate, event.eventYear)}
                      </p>
                      
                      <div className="flex items-center gap-2 mt-2">
                        {event.enableNotifications ? (
                          <Badge variant="outline" className="text-green-400 border-green-400">
                            <Bell className="h-3 w-3 mr-1" />
                            Notifications On
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-white/60 border-white/15">
                            <BellOff className="h-3 w-3 mr-1" />
                            No Notifications
                          </Badge>
                        )}
                        
                        {reminders.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {reminders.length} reminder{reminders.length > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                      
                      {event.customMessage && (
                        <p className="text-sm text-white/70 mt-2 italic">
                          "{event.customMessage}"
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(event)}
                      className="h-8 w-8 text-white/60 hover:text-white hover:bg-tsCard"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteEventMutation.mutate(event.id)}
                      className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          }) : null
        )}
      </div>
    </div>
  );
}