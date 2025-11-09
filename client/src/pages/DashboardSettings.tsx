import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Settings, Save, LayoutGrid } from 'lucide-react';
import { AVAILABLE_WIDGETS } from '@/components/dashboard/DashboardWidgets';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export default function DashboardSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: preferences } = useQuery({
    queryKey: ['/api/users/preferences'],
  });

  const defaultEnabledWidgets = AVAILABLE_WIDGETS
    .filter(w => w.defaultEnabled)
    .map(w => w.id);

  const [enabledWidgets, setEnabledWidgets] = useState<string[]>(
    (preferences && (preferences as any).dashboard?.enabledWidgets) || defaultEnabledWidgets
  );

  const savePreferencesMutation = useMutation({
    mutationFn: async (data: { dashboard: { enabledWidgets: string[] } }) => {
      const response = await fetch('/api/users/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to save preferences');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/preferences'] });
      toast({
        title: 'Settings saved',
        description: 'Your dashboard preferences have been updated.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save dashboard preferences.',
        variant: 'destructive',
      });
    },
  });

  const handleToggleWidget = (widgetId: string) => {
    setEnabledWidgets(prev =>
      prev.includes(widgetId)
        ? prev.filter(id => id !== widgetId)
        : [...prev, widgetId]
    );
  };

  const handleSave = () => {
    savePreferencesMutation.mutate({
      dashboard: {
        enabledWidgets,
      },
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <Settings className="h-6 w-6 text-orange-600 dark:text-orange-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                Dashboard Settings
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Customize what you see on your homepage
              </p>
            </div>
          </div>
        </div>

        {/* Widgets Configuration */}
        <Card className="bg-white dark:bg-slate-800 border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-orange-500" />
              Dashboard Widgets
            </CardTitle>
            <CardDescription>
              Choose which widgets to display on your homepage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {AVAILABLE_WIDGETS.map((widget) => (
              <div
                key={widget.id}
                className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <div className="flex-1">
                  <Label
                    htmlFor={widget.id}
                    className="font-medium text-slate-900 dark:text-white cursor-pointer"
                  >
                    {widget.name}
                  </Label>
                  {widget.defaultEnabled && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Recommended widget
                    </p>
                  )}
                </div>
                <Switch
                  id={widget.id}
                  checked={enabledWidgets.includes(widget.id)}
                  onCheckedChange={() => handleToggleWidget(widget.id)}
                  data-testid={`switch-${widget.id}`}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="mt-6 flex justify-end gap-3">
          <Button
            onClick={handleSave}
            disabled={savePreferencesMutation.isPending}
            className="bg-orange-600 hover:bg-orange-700 text-white"
            data-testid="button-save-dashboard-settings"
          >
            <Save className="h-4 w-4 mr-2" />
            {savePreferencesMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        {/* Preview Note */}
        <Card className="mt-6 bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>Tip:</strong> Your changes will take effect immediately on your dashboard. 
              You can always come back and adjust your widget preferences.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
