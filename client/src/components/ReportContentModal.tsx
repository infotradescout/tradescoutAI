import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Flag, AlertTriangle } from "lucide-react";

const reportSchema = z.object({
  reason: z.string().min(1, "Please select a reason for reporting"),
  description: z.string().optional(),
});

type ReportFormData = z.infer<typeof reportSchema>;

interface ReportContentModalProps {
  contentType: "contractor_profile" | "handmade_product" | "food_listing" | "social_post";
  contentId: string;
  contentOwnerId: string;
  triggerClassName?: string;
  children?: React.ReactNode;
}

const reasonOptions = {
  contractor_profile: [
    { value: "fake_credentials", label: "Fake credentials or certifications" },
    { value: "misleading_info", label: "Misleading information" },
    { value: "inappropriate_content", label: "Inappropriate content" },
    { value: "spam", label: "Spam or promotional abuse" },
    { value: "harassment", label: "Harassment or inappropriate behavior" },
    { value: "other", label: "Other" },
  ],
  handmade_product: [
    { value: "counterfeit", label: "Counterfeit or not handmade" },
    { value: "misleading_description", label: "Misleading product description" },
    { value: "inappropriate_content", label: "Inappropriate content or images" },
    { value: "overpriced", label: "Unreasonably overpriced" },
    { value: "spam", label: "Spam or duplicate listings" },
    { value: "prohibited_item", label: "Prohibited item" },
    { value: "other", label: "Other" },
  ],
  food_listing: [
    { value: "unsafe_food", label: "Unsafe food preparation" },
    { value: "misleading_ingredients", label: "Misleading ingredients or allergens" },
    { value: "expired_food", label: "Expired or spoiled food" },
    { value: "unlicensed_seller", label: "Unlicensed food seller" },
    { value: "inappropriate_content", label: "Inappropriate content" },
    { value: "spam", label: "Spam or duplicate listings" },
    { value: "other", label: "Other" },
  ],
  social_post: [
    { value: "harassment", label: "Harassment or bullying" },
    { value: "hate_speech", label: "Hate speech" },
    { value: "misinformation", label: "Misinformation" },
    { value: "spam", label: "Spam" },
    { value: "inappropriate_content", label: "Inappropriate content" },
    { value: "off_topic", label: "Off-topic or irrelevant" },
    { value: "other", label: "Other" },
  ],
};

export function ReportContentModal({ 
  contentType, 
  contentId, 
  contentOwnerId, 
  triggerClassName, 
  children 
}: ReportContentModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ReportFormData>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      reason: "",
      description: "",
    },
  });

  const reportMutation = useMutation({
    mutationFn: async (data: ReportFormData) => {
      return apiRequest("POST", "/api/moderation/reports", {
        contentType,
        contentId,
        contentOwnerId,
        reason: data.reason,
        description: data.description,
      });
    },
    onSuccess: () => {
      toast({
        title: "Report Submitted",
        description: "Thank you for reporting this content. It will be reviewed by the community.",
      });
      setIsOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/moderation/reports"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Report Failed",
        description: error.message || "Failed to submit report",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ReportFormData) => {
    reportMutation.mutate(data);
  };

  const reasons = reasonOptions[contentType] || reasonOptions.social_post;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button
            variant="outline"
            size="sm"
            className={`text-error border-error/30 hover:bg-error/10 ${triggerClassName}`}
          >
            <Flag className="h-4 w-4 mr-2" />
            Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-error" />
            Report Content
          </DialogTitle>
          <DialogDescription>
            Help us keep the community safe by reporting inappropriate content.
            Reports will be reviewed by community members.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for reporting</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a reason" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {reasons.map((reason) => (
                        <SelectItem key={reason.value} value={reason.value}>
                          {reason.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional details (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide any additional context that would help reviewers..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={reportMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={reportMutation.isPending}
                className="bg-error hover:bg-error/90 text-error-foreground"
              >
                {reportMutation.isPending ? "Submitting..." : "Submit Report"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}