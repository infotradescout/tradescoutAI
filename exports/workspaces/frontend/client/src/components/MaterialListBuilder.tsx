import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, Plus, Trash2, DollarSign, Package, ExternalLink } from "lucide-react";

// Add crypto for UUID generation
const crypto = globalThis.crypto;

interface MaterialItem {
  id: string;
  name: string;
  quantity: number;
  estimatedCost: number;
  vendor?: string;
  sku?: string;
  suggestedBy: "homeowner" | "contractor";
  status: "pending" | "approved" | "denied";
  denialReason?: string;
  notes?: string;
}

interface MaterialListBuilderProps {
  conversationId: string;
  materialListId?: string;
  existingMaterialList?: any;
  userRole?: "homeowner" | "contractor";
  onClose?: () => void;
}

export function MaterialListBuilder({
  conversationId,
  materialListId,
  existingMaterialList,
  userRole = "homeowner",
  onClose,
}: MaterialListBuilderProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<MaterialItem[]>(
    existingMaterialList?.items || [
      {
        id: crypto.randomUUID(),
        name: "",
        quantity: 1,
        estimatedCost: 0,
        vendor: "Home Depot",
        sku: "",
        suggestedBy: userRole,
        status: "pending",
      },
    ]
  );
  const [isOpen, setIsOpen] = useState(false);

  const createMaterialListMutation = useMutation({
    mutationFn: async (materialListData: any) => {
      return apiRequest("POST", "/api/material-lists", materialListData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", conversationId, "material-lists"],
      });
      toast({
        title: "Success",
        description: "Material list created successfully!",
      });
      resetForm();
      setIsOpen(false);
      onClose?.();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create material list. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setItems([
      {
        id: crypto.randomUUID(),
        name: "",
        quantity: 1,
        estimatedCost: 0,
        vendor: "Home Depot",
        sku: "",
        suggestedBy: userRole,
        status: "pending",
      },
    ]);
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        name: "",
        quantity: 1,
        estimatedCost: 0,
        vendor: "Home Depot",
        sku: "",
        suggestedBy: userRole,
        status: "pending",
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof MaterialItem, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setItems(updatedItems);
  };

  const calculateTotal = () => {
    return items
      .filter((item) => item.status === "approved" || item.status === "pending")
      .reduce((total, item) => total + item.quantity * item.estimatedCost, 0);
  };

  // Suggestion and approval mutations
  const addSuggestionMutation = useMutation({
    mutationFn: async (suggestionData: any) => {
      return apiRequest(
        "POST",
        `/api/material-lists/${materialListId}/suggestions`,
        suggestionData
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", conversationId, "material-lists"],
      });
      toast({
        title: "Success",
        description: "Item suggestion added successfully!",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add suggestion. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateItemStatusMutation = useMutation({
    mutationFn: async ({
      itemId,
      status,
      denialReason,
    }: {
      itemId: string;
      status: "approved" | "denied";
      denialReason?: string;
    }) => {
      return apiRequest("PATCH", `/api/material-lists/${materialListId}/items/${itemId}/status`, {
        status,
        denialReason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", conversationId, "material-lists"],
      });
      toast({
        title: "Success",
        description: "Item status updated successfully!",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update item status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!title.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a title for the material list.",
        variant: "destructive",
      });
      return;
    }

    const validItems = items.filter((item) => item.name.trim() && item.quantity > 0);
    if (validItems.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one valid material item.",
        variant: "destructive",
      });
      return;
    }

    const materialListData = {
      conversationId,
      title: title.trim(),
      description: description.trim(),
      items: validItems,
      totalEstimatedCost: calculateTotal(),
      vendorInfo: {
        primaryVendor: "Home Depot",
        notes: "Shopping cart style material list for easy ordering",
      },
      status: "draft",
    };

    createMaterialListMutation.mutate(materialListData);
  };

  const generateHomeDepotLink = (item: MaterialItem) => {
    if (!item.sku) return "#";
    return `https://www.homedepot.com/p/${item.sku}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-purple-500 text-purple-500 hover:bg-purple-500 hover:text-white"
        >
          <ShoppingCart className="h-4 w-4 mr-1" />
          Create Material List
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-tsCard border-white/10 max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Create Material List
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">List Title *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Kitchen Renovation Materials"
                className="form-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional notes about this material list..."
                className="form-field"
                rows={2}
              />
            </div>
          </div>

          {/* Material Items */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-white">Materials</h4>
              {/* Show different buttons based on context */}
              {materialListId ? (
                <Button
                  onClick={() => {
                    const newItem = {
                      id: crypto.randomUUID(),
                      name: "",
                      quantity: 1,
                      estimatedCost: 0,
                      vendor: "Home Depot",
                      sku: "",
                      suggestedBy: userRole,
                      status: "pending" as const,
                      notes: "",
                    };
                    setItems([...items, newItem]);
                  }}
                  variant="outline"
                  size="sm"
                  className="border-green-500 text-green-500 hover:bg-green-500 hover:text-white"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {userRole === "homeowner" ? "Suggest Item" : "Add Item"}
                </Button>
              ) : (
                <Button
                  onClick={addItem}
                  variant="outline"
                  size="sm"
                  className="border-green-500 text-green-500 hover:bg-green-500 hover:text-white"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              )}
            </div>

            <div className="space-y-4">
              {Array.isArray(items)
                ? items.map((item, index) => (
                    <Card key={index} className="bg-tsCard border-white/10">
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                          <div className="md:col-span-2">
                            <label className="block text-xs text-white/60 mb-1">Item Name *</label>
                            <Input
                              value={item.name}
                              onChange={(e) => updateItem(index, "name", e.target.value)}
                              placeholder="e.g., 2x4 Lumber"
                              className="form-field text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-white/60 mb-1">Quantity</label>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                updateItem(index, "quantity", parseInt(e.target.value) || 1)
                              }
                              className="form-field text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-white/60 mb-1">
                              Unit Cost ($)
                            </label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.estimatedCost}
                              onChange={(e) =>
                                updateItem(index, "estimatedCost", parseFloat(e.target.value) || 0)
                              }
                              className="form-field text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-white/60 mb-1">SKU/Model #</label>
                            <Input
                              value={item.sku}
                              onChange={(e) => updateItem(index, "sku", e.target.value)}
                              placeholder="SKU"
                              className="form-field text-sm"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            {item.sku && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(generateHomeDepotLink(item), "_blank")}
                                className="border-ts-orange/30 text-ts-orange hover:bg-ts-orange hover:text-white"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              onClick={() => removeItem(index)}
                              variant="outline"
                              size="sm"
                              disabled={items.length === 1}
                              className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              <Package className="h-3 w-3 mr-1" />
                              {item.vendor || "Home Depot"}
                            </Badge>

                            {/* Status badge */}
                            <Badge
                              variant={
                                item.status === "approved"
                                  ? "default"
                                  : item.status === "denied"
                                    ? "error"
                                    : "secondary"
                              }
                              className="text-xs"
                            >
                              {item.status === "pending" && `Suggested by ${item.suggestedBy}`}
                              {item.status === "approved" && "Approved"}
                              {item.status === "denied" && "Denied"}
                            </Badge>

                            {/* Approval buttons for contractors */}
                            {userRole === "contractor" &&
                              item.status === "pending" &&
                              item.suggestedBy === "homeowner" && (
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      updateItemStatusMutation.mutate({
                                        itemId: item.id,
                                        status: "approved",
                                      })
                                    }
                                    className="border-green-500 text-green-500 hover:bg-green-500 hover:text-white h-6 px-2"
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      updateItemStatusMutation.mutate({
                                        itemId: item.id,
                                        status: "denied",
                                        denialReason: "Not suitable for this project",
                                      })
                                    }
                                    className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white h-6 px-2"
                                  >
                                    Deny
                                  </Button>
                                </div>
                              )}
                          </div>
                          <div className="text-sm font-medium text-ts-orange">
                            Subtotal: ${(item.quantity * item.estimatedCost).toFixed(2)}
                          </div>
                        </div>

                        {/* Show denial reason if denied */}
                        {item.status === "denied" && item.denialReason && (
                          <div className="mt-2 p-2 bg-red-900/20 border border-red-500/30 rounded text-xs text-red-400">
                            <strong>Denial reason:</strong> {item.denialReason}
                          </div>
                        )}

                        {/* Show notes if any */}
                        {item.notes && (
                          <div className="mt-2 p-2 bg-blue-900/20 border border-blue-500/30 rounded text-xs text-blue-400">
                            <strong>Notes:</strong> {item.notes}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                : null}
            </div>
          </div>

          {/* Total */}
          <Card className="bg-gradient-to-r from-orange-500/20 to-orange-600/20 border-ts-orange/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-ts-orange" />
                  <span className="text-lg font-semibold text-white">Total Estimated Cost</span>
                </div>
                <div className="text-2xl font-bold text-ts-orange">
                  ${calculateTotal().toFixed(2)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="border-white/15 text-white/70"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMaterialListMutation.isPending}
              className="btn-primary"
            >
              {createMaterialListMutation.isPending ? "Creating..." : "Create Material List"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
