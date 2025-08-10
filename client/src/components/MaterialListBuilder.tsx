import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, Plus, Trash2, DollarSign, Package, ExternalLink } from "lucide-react";

interface MaterialItem {
  name: string;
  quantity: number;
  estimatedCost: number;
  vendor?: string;
  sku?: string;
}

interface MaterialListBuilderProps {
  conversationId: string;
  onClose?: () => void;
}

export function MaterialListBuilder({ conversationId, onClose }: MaterialListBuilderProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<MaterialItem[]>([
    { name: "", quantity: 1, estimatedCost: 0, vendor: "Home Depot", sku: "" }
  ]);
  const [isOpen, setIsOpen] = useState(false);

  const createMaterialListMutation = useMutation({
    mutationFn: async (materialListData: any) => {
      return apiRequest("POST", "/api/material-lists", materialListData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/conversations", conversationId, "material-lists"] 
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
    setItems([{ name: "", quantity: 1, estimatedCost: 0, vendor: "Home Depot", sku: "" }]);
  };

  const addItem = () => {
    setItems([...items, { name: "", quantity: 1, estimatedCost: 0, vendor: "Home Depot", sku: "" }]);
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
    return items.reduce((total, item) => total + (item.quantity * item.estimatedCost), 0);
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a title for the material list.",
        variant: "destructive",
      });
      return;
    }

    const validItems = items.filter(item => item.name.trim() && item.quantity > 0);
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
        notes: "Shopping cart style material list for easy ordering"
      },
      status: "draft"
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
      <DialogContent className="bg-navy-700 border-navy-600 max-w-4xl max-h-[90vh] overflow-y-auto">
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
              <label className="block text-sm font-medium text-gray-300 mb-2">
                List Title *
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Kitchen Renovation Materials"
                className="form-field"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
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
              <Button
                onClick={addItem}
                variant="outline"
                size="sm"
                className="border-green-500 text-green-500 hover:bg-green-500 hover:text-white"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>
            
            <div className="space-y-4">
              {items.map((item, index) => (
                <Card key={index} className="bg-navy-600 border-navy-500">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                      <div className="md:col-span-2">
                        <label className="block text-xs text-gray-400 mb-1">
                          Item Name *
                        </label>
                        <Input
                          value={item.name}
                          onChange={(e) => updateItem(index, "name", e.target.value)}
                          placeholder="e.g., 2x4 Lumber"
                          className="form-field text-sm"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">
                          Quantity
                        </label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                          className="form-field text-sm"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">
                          Unit Cost ($)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.estimatedCost}
                          onChange={(e) => updateItem(index, "estimatedCost", parseFloat(e.target.value) || 0)}
                          className="form-field text-sm"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">
                          SKU/Model #
                        </label>
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
                            className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
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
                      </div>
                      <div className="text-sm font-medium text-orange-400">
                        Subtotal: ${(item.quantity * item.estimatedCost).toFixed(2)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Total */}
          <Card className="bg-gradient-to-r from-orange-500/20 to-orange-600/20 border-orange-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-orange-400" />
                  <span className="text-lg font-semibold text-white">
                    Total Estimated Cost
                  </span>
                </div>
                <div className="text-2xl font-bold text-orange-400">
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
              className="border-gray-600 text-gray-300"
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