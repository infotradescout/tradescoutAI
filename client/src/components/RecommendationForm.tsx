import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { ThumbsUp, ThumbsDown, Clock, MessageSquare, Star } from "lucide-react";
import { Link } from "wouter";

const recommendationSchema = z.object({
  recommendationType: z.enum(["positive", "negative"]),
  comment: z.string().min(10, "Please provide at least 10 characters of feedback"),
  projectType: z.string().optional(),
  projectValue: z.string().optional(),
  workQuality: z.number().min(1).max(5).optional(),
  timeliness: z.number().min(1).max(5).optional(),
  communication: z.number().min(1).max(5).optional(),
  wouldHireAgain: z.boolean().optional(),
  customerName: z.string().min(2, "Name is required"),
  customerEmail: z.string().email("Valid email is required"),
  customerPhone: z.string().optional(),
});

type RecommendationFormData = z.infer<typeof recommendationSchema>;

interface RecommendationFormProps {
  contractorId: string;
  contractorName: string;
  onSuccess?: () => void;
}

export function RecommendationForm({
  contractorId,
  contractorName,
  onSuccess,
}: RecommendationFormProps) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const form = useForm<RecommendationFormData>({
    resolver: zodResolver(recommendationSchema),
    defaultValues: {
      recommendationType: "positive",
      customerName: user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : "",
      customerEmail: user?.email || "",
      comment: "",
      projectType: "",
      projectValue: "",
      workQuality: 5,
      timeliness: 5,
      communication: 5,
      wouldHireAgain: true,
      customerPhone: "",
    },
  });

  const submitRecommendation = useMutation({
    mutationFn: async (data: RecommendationFormData) => {
      const response = await fetch(`/api/contractors/${contractorId}/recommendations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to submit recommendation");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Recommendation Submitted",
        description:
          "Your recommendation has been submitted and will be reviewed before publishing.",
      });
      form.reset();
      setShowForm(false);
      onSuccess?.();
      // Invalidate contractor data to refresh recommendations
      queryClient.invalidateQueries({ queryKey: [`/api/contractors/${contractorId}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit recommendation. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!isAuthenticated) {
    return (
      <Card className="bg-tsCard border-white/10">
        <CardContent className="p-6">
          <div className="text-center">
            <MessageSquare className="h-12 w-12 text-ts-orange mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Share Your Experience</h3>
            <p className="text-white/70 mb-4">
              Help other homeowners by sharing your experience with {contractorName}
            </p>
            <Link href="/pre-scout-setup?mode=signin">
              <Button
                className="bg-ts-orange hover:bg-ts-orange-dark"
                data-testid="button-login-to-recommend"
              >
                Sign In to Leave Recommendation
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!showForm) {
    return (
      <Card className="bg-tsCard border-white/10">
        <CardContent className="p-6">
          <div className="text-center">
            <MessageSquare className="h-12 w-12 text-ts-orange mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Share Your Experience</h3>
            <p className="text-white/70 mb-4">
              Help other homeowners by sharing your experience with {contractorName}
            </p>
            <Button
              onClick={() => setShowForm(true)}
              className="bg-ts-orange hover:bg-ts-orange-dark"
              data-testid="button-write-recommendation"
            >
              Write a Recommendation
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-tsCard border-white/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <MessageSquare className="h-5 w-5 mr-2 text-ts-orange" />
          Recommend {contractorName}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => submitRecommendation.mutate(data))}
            className="space-y-6"
          >
            {/* Recommendation Type */}
            <FormField
              control={form.control}
              name="recommendationType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Would you recommend this contractor?</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex gap-6"
                      data-testid="radio-recommendation-type"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="positive" id="positive" />
                        <label
                          htmlFor="positive"
                          className="flex items-center text-green-400 cursor-pointer"
                        >
                          <ThumbsUp className="h-4 w-4 mr-1" />
                          Yes, I recommend
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="negative" id="negative" />
                        <label
                          htmlFor="negative"
                          className="flex items-center text-red-400 cursor-pointer"
                        >
                          <ThumbsDown className="h-4 w-4 mr-1" />
                          No, I don't recommend
                        </label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Customer Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Your Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="bg-tsCard border-white/10 text-white"
                        data-testid="input-customer-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customerEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Your Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        className="bg-tsCard border-white/10 text-white"
                        data-testid="input-customer-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Project Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="projectType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Project Type</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., Kitchen Remodel, Roof Repair"
                        className="bg-tsCard border-white/10 text-white"
                        data-testid="input-project-type"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="projectValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Project Value (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger
                          className="bg-tsCard border-white/10 text-white"
                          data-testid="select-project-value"
                        >
                          <SelectValue placeholder="Select range" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="under-1000">Under $1,000</SelectItem>
                        <SelectItem value="1000-5000">$1,000 - $5,000</SelectItem>
                        <SelectItem value="5000-15000">$5,000 - $15,000</SelectItem>
                        <SelectItem value="15000-50000">$15,000 - $50,000</SelectItem>
                        <SelectItem value="over-50000">Over $50,000</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Detailed Comment */}
            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Your Experience</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Share details about your experience with this contractor..."
                      className="bg-tsCard border-white/10 text-white min-h-24"
                      data-testid="textarea-comment"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Optional Ratings */}
            {form.watch("recommendationType") === "positive" && (
              <div className="space-y-4">
                <h4 className="text-white font-medium">Rate Your Experience (Optional)</h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="workQuality"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white text-sm">Work Quality</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={(value) => field.onChange(parseInt(value))}
                            defaultValue={field.value?.toString()}
                          >
                            <SelectTrigger
                              className="bg-tsCard border-white/10 text-white"
                              data-testid="select-work-quality"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[5, 4, 3, 2, 1].map((num) => (
                                <SelectItem key={num} value={num.toString()}>
                                  {num} Star{num !== 1 ? "s" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="timeliness"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white text-sm">Timeliness</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={(value) => field.onChange(parseInt(value))}
                            defaultValue={field.value?.toString()}
                          >
                            <SelectTrigger
                              className="bg-tsCard border-white/10 text-white"
                              data-testid="select-timeliness"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[5, 4, 3, 2, 1].map((num) => (
                                <SelectItem key={num} value={num.toString()}>
                                  {num} Star{num !== 1 ? "s" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="communication"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white text-sm">Communication</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={(value) => field.onChange(parseInt(value))}
                            defaultValue={field.value?.toString()}
                          >
                            <SelectTrigger
                              className="bg-tsCard border-white/10 text-white"
                              data-testid="select-communication"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[5, 4, 3, 2, 1].map((num) => (
                                <SelectItem key={num} value={num.toString()}>
                                  {num} Star{num !== 1 ? "s" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex gap-4">
              <Button
                type="submit"
                disabled={submitRecommendation.isPending}
                className="bg-ts-orange hover:bg-ts-orange-dark flex-1"
                data-testid="button-submit-recommendation"
              >
                {submitRecommendation.isPending ? "Submitting..." : "Submit Recommendation"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
                className="border-white/10 text-white hover:bg-tsCard"
                data-testid="button-cancel-recommendation"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
