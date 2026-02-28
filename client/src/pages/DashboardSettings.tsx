import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Settings, Save, LayoutGrid, GripVertical } from "lucide-react";
import { AVAILABLE_WIDGETS } from "@/components/dashboard/DashboardWidgets";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

export default function DashboardSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["/api/users/preferences"],
  });

  type DashboardWidgetId = (typeof AVAILABLE_WIDGETS)[number]["id"];

  const defaultEnabledWidgets: DashboardWidgetId[] = AVAILABLE_WIDGETS.filter(
    (w) => w.defaultEnabled
  ).map((w) => w.id);

  const [enabledWidgets, setEnabledWidgets] = useState<DashboardWidgetId[]>(defaultEnabledWidgets);
  const [widgetOrder, setWidgetOrder] = useState<DashboardWidgetId[]>(() =>
    AVAILABLE_WIDGETS.map((w) => w.id)
  );

  useEffect(() => {
    const dashboardPrefs = (preferences && (preferences as any).dashboard) || {};

    const enabledFromPrefs: DashboardWidgetId[] = Array.isArray(dashboardPrefs.enabledWidgets)
      ? (dashboardPrefs.enabledWidgets.filter((id: string): id is DashboardWidgetId =>
          AVAILABLE_WIDGETS.some((w) => w.id === id)
        ) as DashboardWidgetId[])
      : defaultEnabledWidgets;

    const defaultOrder: DashboardWidgetId[] = AVAILABLE_WIDGETS.map((w) => w.id);
    let orderFromPrefs: DashboardWidgetId[] =
      Array.isArray(dashboardPrefs.widgetOrder) && dashboardPrefs.widgetOrder.length
        ? (dashboardPrefs.widgetOrder.filter((id: string): id is DashboardWidgetId =>
            AVAILABLE_WIDGETS.some((w) => w.id === id)
          ) as DashboardWidgetId[])
        : defaultOrder;

    const availableIdSet = new Set<DashboardWidgetId>(defaultOrder);
    orderFromPrefs = orderFromPrefs.filter((id) => availableIdSet.has(id));
    defaultOrder.forEach((id) => {
      if (!orderFromPrefs.includes(id)) {
        orderFromPrefs.push(id);
      }
    });

    setEnabledWidgets(enabledFromPrefs);
    setWidgetOrder(orderFromPrefs);
  }, [preferences, defaultEnabledWidgets]);

  const savePreferencesMutation = useMutation({
    mutationFn: async (data: {
      dashboard: { enabledWidgets: DashboardWidgetId[]; widgetOrder: DashboardWidgetId[] };
    }) => {
      const response = await fetch("/api/users/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to save preferences");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/preferences"] });
      toast({
        title: "Settings saved",
        description: "Your dashboard preferences have been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save dashboard preferences.",
        variant: "destructive",
      });
    },
  });

  const handleToggleWidget = (widgetId: DashboardWidgetId) => {
    setEnabledWidgets((prev) =>
      prev.includes(widgetId) ? prev.filter((id) => id !== widgetId) : [...prev, widgetId]
    );
  };

  const handleSave = () => {
    savePreferencesMutation.mutate({
      dashboard: {
        enabledWidgets,
        widgetOrder,
      },
    });
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(widgetOrder);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setWidgetOrder(items);
  };

  return (
    <div className=" dark:bg-tsCard">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-ts-orange/10 dark:bg-ts-orange/10 rounded-lg">
              <Settings className="h-6 w-6 text-ts-orange dark:text-ts-orange" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-ts-orange">Dashboard Settings</h1>
              <p className="text-white/60 dark:text-white/60 text-sm">
                Customize what you see on your homepage
              </p>
            </div>
          </div>
        </div>

        {/* Widgets Configuration */}
        <Card className="bg-tsBg dark:bg-white/5 border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-ts-orange" />
              Dashboard Widgets
            </CardTitle>
            <CardDescription>Choose which widgets to display on your homepage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-white/60 dark:text-white/60">
                Loading your dashboard preferences...
              </p>
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="dashboard-widgets">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                      {widgetOrder.map((widgetId, index) => {
                        const widget = AVAILABLE_WIDGETS.find((w) => w.id === widgetId);
                        if (!widget) return null;
                        const isEnabled = enabledWidgets.includes(widget.id);
                        return (
                          <Draggable key={widget.id} draggableId={widget.id} index={index}>
                            {(draggableProvided, snapshot) => (
                              <div
                                ref={draggableProvided.innerRef}
                                {...draggableProvided.draggableProps}
                                className={`flex items-center justify-between p-4 rounded-lg bg-tsBg dark:bg-white/10 hover:bg-white/5 dark:hover:bg-white/10 transition-colors border ${
                                  snapshot.isDragging
                                    ? "border-ts-orange/30 shadow-md"
                                    : "border-transparent"
                                }`}
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  <button
                                    type="button"
                                    aria-label="Reorder widget"
                                    {...draggableProvided.dragHandleProps}
                                    className="text-white/60 hover:text-ts-orange cursor-grab active:cursor-grabbing"
                                  >
                                    <GripVertical className="h-4 w-4" />
                                  </button>
                                  <div className="flex-1">
                                    <Label
                                      htmlFor={widget.id}
                                      className="font-medium text-ts-orange cursor-pointer"
                                    >
                                      {widget.name}
                                    </Label>
                                    {widget.defaultEnabled && (
                                      <p className="text-xs text-white/60 dark:text-white/60 mt-1">
                                        Recommended widget
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <Switch
                                  id={widget.id}
                                  checked={isEnabled}
                                  onCheckedChange={() => handleToggleWidget(widget.id)}
                                  data-testid={`switch-${widget.id}`}
                                />
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="mt-6 flex justify-end gap-3">
          <Button
            onClick={handleSave}
            disabled={savePreferencesMutation.isPending}
            className="bg-ts-orange-dark hover:bg-ts-orange-dark text-white"
            data-testid="button-save-dashboard-settings"
          >
            <Save className="h-4 w-4 mr-2" />
            {savePreferencesMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        {/* Preview Note */}
        <Card className="mt-6 bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>Tip:</strong> Your changes will take effect immediately on your dashboard. You
              can always come back and adjust your widget preferences.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
