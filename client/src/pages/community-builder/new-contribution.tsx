import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";

const contributionTypes = [
  { value: "service_hours", label: "Service Hours" },
  { value: "materials", label: "Materials & Goods" },
  { value: "equipment_rental", label: "Equipment Rental" },
  { value: "financial", label: "Financial Contribution" },
  { value: "expertise", label: "Professional Expertise" },
  { value: "promotion", label: "Marketing & Visibility" },
  { value: "administration", label: "Admin & Coordination" },
];

type ContributionInput = {
  title: string;
  description: string;
  type: string;
  estimatedValue: string;
  estimatedHours: string;
  proposedStartDate: string;
  proposedEndDate: string;
  impact: string;
  tags: string;
};

export default function NewContribution() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [formData, setFormData] = useState<ContributionInput>({
    title: "",
    description: "",
    type: "service_hours",
    estimatedValue: "",
    estimatedHours: "",
    proposedStartDate: "",
    proposedEndDate: "",
    impact: "",
    tags: "",
  });

  const createMutation = useMutation<any, Error, ContributionInput>({
    mutationFn: async (data) => {
      const tags = data.tags
        ? data.tags
            .split(",")
            .map((t: string) => t.trim())
            .filter(Boolean)
        : [];

      const res = await fetch("/api/community-builder/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          tags,
        }),
      });
      if (!res.ok) throw new Error("Failed to create contribution");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: "Contribution proposed successfully!" });
      navigate(`/community-builder/contributions/${data.id}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create contribution",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.description || !formData.estimatedValue) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate(formData);
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate("/community-builder/dashboard")}>
          ← Back to Dashboard
        </Button>

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Propose a Contribution</h1>
          <p className="text-gray-600 mt-2">
            Share how you want to contribute to your county's community
          </p>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Contribution Details</CardTitle>
            <CardDescription>All fields with * are required</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold mb-2">Contribution Title *</label>
                <Input
                  type="text"
                  placeholder="e.g., Community Garden Setup & Maintenance"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Keep it clear and descriptive (50-100 characters)
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold mb-2">Description *</label>
                <Textarea
                  placeholder="Describe your contribution in detail. What will you do? Why does it matter? What's the expected impact?"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={5}
                  required
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-semibold mb-2">Contribution Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {contributionTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Value Grid */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Estimated Value ($) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.estimatedValue}
                    onChange={(e) => setFormData({ ...formData, estimatedValue: e.target.value })}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Total dollar value of this contribution
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Estimated Hours</label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="0.0"
                    value={formData.estimatedHours}
                    onChange={(e) => setFormData({ ...formData, estimatedHours: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">If applicable (service hours)</p>
                </div>
              </div>

              {/* Timeline Grid */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Proposed Start Date</label>
                  <Input
                    type="date"
                    value={formData.proposedStartDate}
                    onChange={(e) =>
                      setFormData({ ...formData, proposedStartDate: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Proposed End Date</label>
                  <Input
                    type="date"
                    value={formData.proposedEndDate}
                    onChange={(e) => setFormData({ ...formData, proposedEndDate: e.target.value })}
                  />
                </div>
              </div>

              {/* Impact */}
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Expected Community Impact
                </label>
                <Textarea
                  placeholder="How will this contribution improve your community? Who will benefit? What positive changes will result?"
                  value={formData.impact}
                  onChange={(e) => setFormData({ ...formData, impact: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-semibold mb-2">Tags (Optional)</label>
                <Input
                  type="text"
                  placeholder="community, environment, education (comma-separated)"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                />
              </div>

              {/* Guidelines */}
              <Card className="border-2 border-blue-200 bg-blue-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Before You Submit
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <p>✓ Your contribution will be reviewed by county administrators</p>
                  <p>✓ You can edit it until it's approved</p>
                  <p>✓ Once approved, you can add evidence and documentation</p>
                  <p>✓ Final verification will lock in the value</p>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {createMutation.isPending ? "Submitting..." : "Propose Contribution"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/community-builder/dashboard")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
