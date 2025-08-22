import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Settings, Plus, Eye, EyeOff, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface FeatureFlag {
  id: string;
  name: string;
  key: string;
  description: string;
  enabled: boolean;
  category: string;
  userRoles: string[];
  createdAt: string;
  updatedAt: string;
}

export default function FeatureTogglePanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newFeature, setNewFeature] = useState({
    name: '',
    key: '',
    description: '',
    category: 'general',
    userRoles: ['homeowner', 'contractor_user']
  });
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch feature flags
  const { data: features = [], isLoading } = useQuery<FeatureFlag[]>({
    queryKey: ['/api/admin/feature-flags'],
    retry: false,
  });

  // Toggle feature mutation
  const toggleFeatureMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      return apiRequest('PATCH', `/api/admin/feature-flags/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/feature-flags'] });
      toast({
        title: "Feature Updated",
        description: "Feature flag updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create feature mutation
  const createFeatureMutation = useMutation({
    mutationFn: async (featureData: any) => {
      return apiRequest('POST', '/api/admin/feature-flags', featureData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/feature-flags'] });
      setNewFeature({
        name: '',
        key: '',
        description: '',
        category: 'general',
        userRoles: ['homeowner', 'contractor_user']
      });
      setShowAddForm(false);
      toast({
        title: "Feature Created",
        description: "New feature flag created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Creation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleToggle = (id: string, enabled: boolean) => {
    toggleFeatureMutation.mutate({ id, enabled });
  };

  const handleCreateFeature = () => {
    if (!newFeature.name || !newFeature.key) {
      toast({
        title: "Validation Error",
        description: "Name and key are required",
        variant: "destructive",
      });
      return;
    }
    createFeatureMutation.mutate(newFeature);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Feature Control Center
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-muted-foreground">Loading features...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Feature Control Center
              </CardTitle>
              <CardDescription>
                Show or hide platform features for different user types
              </CardDescription>
            </div>
            <Button
              onClick={() => setShowAddForm(!showAddForm)}
              size="sm"
              data-testid="button-add-feature"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Feature
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Add New Feature Form */}
          {showAddForm && (
            <Card className="mb-6 border-dashed">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="feature-name">Feature Name</Label>
                    <Input
                      id="feature-name"
                      value={newFeature.name}
                      onChange={(e) => setNewFeature({...newFeature, name: e.target.value})}
                      placeholder="e.g., Advanced Calculator"
                      data-testid="input-feature-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="feature-key">Feature Key</Label>
                    <Input
                      id="feature-key"
                      value={newFeature.key}
                      onChange={(e) => setNewFeature({...newFeature, key: e.target.value.toLowerCase().replace(/\s+/g, '_')})}
                      placeholder="e.g., advanced_calculator"
                      data-testid="input-feature-key"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="feature-description">Description</Label>
                    <Textarea
                      id="feature-description"
                      value={newFeature.description}
                      onChange={(e) => setNewFeature({...newFeature, description: e.target.value})}
                      placeholder="Describe what this feature does..."
                      data-testid="textarea-feature-description"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleCreateFeature} 
                      disabled={createFeatureMutation.isPending}
                      data-testid="button-save-feature"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Feature
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowAddForm(false)}
                      data-testid="button-cancel-feature"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Feature List */}
          <div className="space-y-4">
            {features.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No feature flags configured yet.</p>
                <p className="text-sm">Create your first feature flag to get started.</p>
              </div>
            ) : (
              features.map((feature) => (
                <Card key={feature.id} className={`transition-all duration-200 ${
                  feature.enabled ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold">{feature.name}</h3>
                          <Badge variant={feature.enabled ? 'default' : 'secondary'}>
                            {feature.category}
                          </Badge>
                          <Badge variant={feature.enabled ? 'default' : 'outline'} className="text-xs">
                            {feature.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {feature.description}
                        </p>
                        <div className="text-xs text-muted-foreground">
                          Key: <code className="bg-muted px-1 rounded">{feature.key}</code>
                          {feature.userRoles && (
                            <span className="ml-4">
                              Roles: {feature.userRoles.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {feature.enabled ? (
                          <Eye className="w-4 h-4 text-green-600" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-red-600" />
                        )}
                        <Switch
                          checked={feature.enabled}
                          onCheckedChange={(enabled) => handleToggle(feature.id, enabled)}
                          data-testid={`switch-feature-${feature.key}`}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common feature management tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                features.forEach(feature => {
                  if (!feature.enabled) {
                    handleToggle(feature.id, true);
                  }
                });
              }}
              data-testid="button-enable-all"
            >
              Enable All
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                features.forEach(feature => {
                  if (feature.enabled) {
                    handleToggle(feature.id, false);
                  }
                });
              }}
              data-testid="button-disable-all"
            >
              Disable All
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['/api/admin/feature-flags'] });
                toast({ title: "Refreshed", description: "Feature flags reloaded" });
              }}
              data-testid="button-refresh"
            >
              Refresh
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                const enabledCount = features.filter(f => f.enabled).length;
                toast({ 
                  title: "Feature Status", 
                  description: `${enabledCount} of ${features.length} features enabled` 
                });
              }}
              data-testid="button-status"
            >
              Show Status
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}