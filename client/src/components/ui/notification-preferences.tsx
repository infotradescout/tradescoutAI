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
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Clock,
  Moon,
  Sun,
  Settings2,
} from 'lucide-react';

interface NotificationPreferences {
  id: string;
  enableNotifications: boolean;
  enableEmailNotifications: boolean;
  enableSmsNotifications: boolean;
  enablePushNotifications: boolean;
  typePreferences: Record<string, {
    enabled: boolean;
    delivery_methods: string[];
    frequency?: 'instant' | 'hourly' | 'daily' | 'weekly';
  }>;
  quietHoursStart: string;
  quietHoursEnd: string;
  timezone: string;
  batchDailyDigest: boolean;
  batchWeeklyDigest: boolean;
  digestTime: string;
}

const preferencesSchema = z.object({
  enableNotifications: z.boolean(),
  enableEmailNotifications: z.boolean(),
  enableSmsNotifications: z.boolean(),
  enablePushNotifications: z.boolean(),
  quietHoursStart: z.string(),
  quietHoursEnd: z.string(),
  timezone: z.string(),
  batchDailyDigest: z.boolean(),
  batchWeeklyDigest: z.boolean(),
  digestTime: z.string(),
  typePreferences: z.record(z.object({
    enabled: z.boolean(),
    delivery_methods: z.array(z.string()),
    frequency: z.enum(['instant', 'hourly', 'daily', 'weekly']).optional(),
  })),
});

type PreferencesForm = z.infer<typeof preferencesSchema>;

interface NotificationPreferencesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const notificationTypes = [
  { key: 'birthday', label: 'Birthday Reminders', description: 'Personal birthday notifications' },
  { key: 'anniversary', label: 'Anniversaries', description: 'Work and business anniversaries' },
  { key: 'new_message', label: 'New Messages', description: 'Chat messages and conversations' },
  { key: 'new_lead', label: 'New Leads', description: 'New customer inquiries' },
  { key: 'review_received', label: 'Recommendations', description: 'Customer recommendations and ratings' },
  { key: 'system_update', label: 'System Updates', description: 'Platform announcements' },
  { key: 'promotional', label: 'Promotions', description: 'Special offers and promotions' },
  { key: 'milestone', label: 'Milestones', description: 'Achievement notifications' },
  { key: 'payment_received', label: 'Payments', description: 'Payment confirmations' },
];

const deliveryMethods = [
  { key: 'in_app', label: 'In-App', icon: Bell },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'sms', label: 'SMS', icon: MessageSquare },
  { key: 'push', label: 'Push', icon: Smartphone },
];

export function NotificationPreferences({ open, onOpenChange }: NotificationPreferencesProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current preferences
  const { data: preferences, isLoading } = useQuery({
    queryKey: ['/api/notifications/preferences'],
    enabled: open,
  });

  const form = useForm<PreferencesForm>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: preferences || {
      enableNotifications: true,
      enableEmailNotifications: true,
      enableSmsNotifications: false,
      enablePushNotifications: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      timezone: 'America/New_York',
      batchDailyDigest: false,
      batchWeeklyDigest: false,
      digestTime: '09:00',
      typePreferences: {},
    },
  });

  // Update form when preferences load
  if (preferences && !form.formState.isDirty) {
    form.reset(preferences);
  }

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: (data: PreferencesForm) => 
      apiRequest('/api/notifications/preferences', {
        method: 'POST',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/preferences'] });
      toast({
        title: 'Preferences Updated',
        description: 'Your notification preferences have been saved.',
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update preferences',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: PreferencesForm) => {
    updatePreferencesMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] bg-navy-800 border-navy-600">
          <div className="flex items-center justify-center p-8">
            <Settings2 className="h-8 w-8 animate-spin text-orange-400" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto bg-navy-800 border-navy-600">
        <DialogHeader>
          <DialogTitle className="text-white">Notification Preferences</DialogTitle>
          <DialogDescription className="text-gray-400">
            Customize how and when you receive notifications from TradeScout.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* General Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Bell className="h-5 w-5 text-orange-400" />
                General Settings
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="enableNotifications"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border border-navy-600 p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-white">Enable Notifications</FormLabel>
                        <FormDescription className="text-gray-400 text-sm">
                          Receive all notifications
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enableEmailNotifications"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border border-navy-600 p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-white flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Email Notifications
                        </FormLabel>
                        <FormDescription className="text-gray-400 text-sm">
                          Send notifications via email
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enableSmsNotifications"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border border-navy-600 p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-white flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          SMS Notifications
                        </FormLabel>
                        <FormDescription className="text-gray-400 text-sm">
                          Send notifications via text message
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enablePushNotifications"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border border-navy-600 p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-white flex items-center gap-2">
                          <Smartphone className="h-4 w-4" />
                          Push Notifications
                        </FormLabel>
                        <FormDescription className="text-gray-400 text-sm">
                          Send browser push notifications
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator className="bg-navy-600" />

            {/* Quiet Hours */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Moon className="h-5 w-5 text-orange-400" />
                Quiet Hours
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="quietHoursStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Start Time</FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          {...field}
                          className="bg-navy-700 border-navy-600 text-white"
                        />
                      </FormControl>
                      <FormDescription className="text-gray-400 text-sm">
                        No notifications after this time
                      </FormDescription>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quietHoursEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">End Time</FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          {...field}
                          className="bg-navy-700 border-navy-600 text-white"
                        />
                      </FormControl>
                      <FormDescription className="text-gray-400 text-sm">
                        Resume notifications at this time
                      </FormDescription>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator className="bg-navy-600" />

            {/* Notification Types */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Notification Types</h3>
              
              <div className="space-y-3">
                {notificationTypes.map((type) => {
                  const currentPrefs = form.watch(`typePreferences.${type.key}`) || {
                    enabled: true,
                    delivery_methods: ['in_app'],
                  };

                  return (
                    <div key={type.key} className="rounded-lg border border-navy-600 p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="text-white font-medium">{type.label}</h4>
                          <p className="text-gray-400 text-sm">{type.description}</p>
                        </div>
                        <Switch
                          checked={currentPrefs.enabled}
                          onCheckedChange={(enabled) => {
                            form.setValue(`typePreferences.${type.key}`, {
                              ...currentPrefs,
                              enabled,
                            });
                          }}
                        />
                      </div>

                      {currentPrefs.enabled && (
                        <div className="space-y-2">
                          <p className="text-sm text-gray-300">Delivery methods:</p>
                          <div className="flex flex-wrap gap-2">
                            {deliveryMethods.map((method) => {
                              const isSelected = currentPrefs.delivery_methods.includes(method.key);
                              const Icon = method.icon;
                              
                              return (
                                <button
                                  key={method.key}
                                  type="button"
                                  onClick={() => {
                                    const newMethods = isSelected
                                      ? currentPrefs.delivery_methods.filter(m => m !== method.key)
                                      : [...currentPrefs.delivery_methods, method.key];
                                    
                                    form.setValue(`typePreferences.${type.key}`, {
                                      ...currentPrefs,
                                      delivery_methods: newMethods,
                                    });
                                  }}
                                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs transition-colors ${
                                    isSelected
                                      ? 'bg-orange-400 text-navy-900'
                                      : 'bg-navy-700 text-gray-300 border border-navy-600'
                                  }`}
                                >
                                  <Icon className="h-3 w-3" />
                                  {method.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator className="bg-navy-600" />

            {/* Digest Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-400" />
                Digest Options
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="batchDailyDigest"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border border-navy-600 p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-white">Daily Digest</FormLabel>
                        <FormDescription className="text-gray-400 text-sm">
                          Receive a daily summary email
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="batchWeeklyDigest"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border border-navy-600 p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-white">Weekly Digest</FormLabel>
                        <FormDescription className="text-gray-400 text-sm">
                          Receive a weekly summary email
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="digestTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Digest Delivery Time</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        className="bg-navy-700 border-navy-600 text-white max-w-xs"
                      />
                    </FormControl>
                    <FormDescription className="text-gray-400">
                      When to send digest emails
                    </FormDescription>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-navy-600 text-white hover:bg-navy-700"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updatePreferencesMutation.isPending}
                className="bg-orange-500 text-white hover:bg-orange-600"
              >
                {updatePreferencesMutation.isPending ? 'Saving...' : 'Save Preferences'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}