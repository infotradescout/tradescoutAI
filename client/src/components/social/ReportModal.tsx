import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Flag,
  AlertTriangle,
  Shield,
  Eye,
  Ban,
  FileText,
} from "lucide-react";

const reportSchema = z.object({
  reason: z.enum([
    'spam',
    'harassment',
    'inappropriate_content',
    'misinformation',
    'hate_speech',
    'violence',
    'scam_fraud',
    'copyright_violation',
    'privacy_violation',
    'other'
  ]),
  description: z.string().min(10, "Please provide more details (at least 10 characters)").max(500, "Description must be less than 500 characters"),
});

type ReportFormData = z.infer<typeof reportSchema>;

interface ReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: string;
  contentType: 'community_post' | 'post_comment' | 'marketplace_listing' | 'user_profile';
}

export function ReportModal({ open, onOpenChange, contentId, contentType }: ReportModalProps) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  const form = useForm<ReportFormData>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      description: "",
    },
  });

  const reportMutation = useMutation({
    mutationFn: (data: ReportFormData) =>
      apiRequest('POST', '/api/social/reports', {
        ...data,
        contentId,
        contentType,
      }),
    onSuccess: () => {
      toast({
        title: "Report Submitted",
        description: "Thank you for helping keep our community safe. We'll review your report.",
      });
      onOpenChange(false);
      form.reset();
      setStep(1);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit report",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ReportFormData) => {
    if (!isAuthenticated) {
      toast({
        title: "Login Required",
        description: "Please login to report content",
        variant: "destructive",
      });
      return;
    }
    reportMutation.mutate(data);
  };

  const reportReasons = [
    {
      value: 'spam',
      label: 'Spam',
      description: 'Unwanted commercial content or repetitive posts',
      icon: Flag,
    },
    {
      value: 'harassment',
      label: 'Harassment',
      description: 'Bullying, threatening, or targeting individuals',
      icon: Shield,
    },
    {
      value: 'inappropriate_content',
      label: 'Inappropriate Content',
      description: 'Content that violates community standards',
      icon: Eye,
    },
    {
      value: 'misinformation',
      label: 'Misinformation',
      description: 'False or misleading information',
      icon: AlertTriangle,
    },
    {
      value: 'hate_speech',
      label: 'Hate Speech',
      description: 'Content that attacks or demeans a group',
      icon: Ban,
    },
    {
      value: 'violence',
      label: 'Violence',
      description: 'Threats, graphic content, or incitement to violence',
      icon: AlertTriangle,
    },
    {
      value: 'scam_fraud',
      label: 'Scam or Fraud',
      description: 'Deceptive practices or fraudulent content',
      icon: Shield,
    },
    {
      value: 'copyright_violation',
      label: 'Copyright Violation',
      description: 'Unauthorized use of copyrighted material',
      icon: FileText,
    },
    {
      value: 'privacy_violation',
      label: 'Privacy Violation',
      description: 'Sharing private information without permission',
      icon: Eye,
    },
    {
      value: 'other',
      label: 'Other',
      description: 'A reason not listed above',
      icon: Flag,
    },
  ];

  const getContentTypeLabel = () => {
    const labels = {
      community_post: 'post',
      post_comment: 'comment',
      marketplace_listing: 'listing',
      user_profile: 'profile',
    };
    return labels[contentType] || 'content';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Flag className="h-5 w-5 text-destructive" />
            <span>Report {getContentTypeLabel()}</span>
          </DialogTitle>
          <DialogDescription>
            Help us maintain a safe and respectful community by reporting inappropriate content.
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">Why are you reporting this {getContentTypeLabel()}?</h4>
              <p className="text-sm text-muted-foreground">
                Your report helps us keep the community safe and respectful for everyone.
              </p>
            </div>

            <RadioGroup
              value={form.watch('reason')}
              onValueChange={(value) => form.setValue('reason', value as any)}
              className="space-y-2"
            >
              {reportReasons.map((reason) => (
                <Card
                  key={reason.value}
                  className={`cursor-pointer transition-all hover:bg-accent ${
                    form.watch('reason') === reason.value ? 'ring-2 ring-primary bg-primary/5' : ''
                  }`}
                  onClick={() => {
                    form.setValue('reason', reason.value as any);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value={reason.value} />
                      <reason.icon className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <Label className="font-medium cursor-pointer">
                          {reason.label}
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {reason.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </RadioGroup>

            <div className="flex justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!form.watch('reason')}
              >
                Next
              </Button>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Selected Reason */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    {(() => {
                      const selectedReason = reportReasons.find(r => r.value === form.watch('reason'));
                      const IconComponent = selectedReason?.icon || Flag;
                      return (
                        <>
                          <IconComponent className="h-5 w-5 text-primary" />
                          <div>
                            <div className="font-medium">{selectedReason?.label}</div>
                            <div className="text-sm text-muted-foreground">
                              {selectedReason?.description}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>

              {/* Additional Details */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Details</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Please provide specific details about why this content violates our community guidelines..."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Help us understand the issue better</span>
                      <span>{field.value?.length || 0}/500</span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Information Box */}
              <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="text-sm">
                      <div className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                        What happens next?
                      </div>
                      <ul className="text-blue-700 dark:text-blue-200 space-y-1">
                        <li>• Our moderation team will review your report</li>
                        <li>• We'll take appropriate action if guidelines are violated</li>
                        <li>• Your report is anonymous to other users</li>
                        <li>• We'll notify you of significant updates</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex justify-end space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={reportMutation.isPending}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  {reportMutation.isPending ? "Submitting..." : "Submit Report"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}