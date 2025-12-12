import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const quoteFormSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  county: z.string().min(1, "Please select your area"),
  projectType: z.string().min(1, "Please select a project type"),
  projectDescription: z.string().optional(),
  timeline: z.string().min(1, "Please select a timeline"),
  budget: z.string().optional(),
});

type QuoteFormData = z.infer<typeof quoteFormSchema>;

interface QuoteFormProps {
  onSuccess?: () => void;
  compact?: boolean;
}

export default function QuoteForm({ onSuccess, compact = false }: QuoteFormProps) {
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      county: "",
      projectType: "",
      projectDescription: "",
      timeline: "",
      budget: "",
    },
  });

  // Fetch counties for dropdown
  const { data: counties = [] } = useQuery({
    queryKey: ["/api/counties"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/counties?state=CA");
      return response;
    },
  });

  // Fetch trades for project types
  const { data: trades = [] } = useQuery({
    queryKey: ["/api/trades"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/trades");
      return Array.isArray(response) ? response : [];
    },
  });

  const submitQuoteMutation = useMutation({
    mutationFn: async (data: QuoteFormData) => {
      return apiRequest("POST", "/api/leads", data);
    },
    onSuccess: () => {
      setIsSubmitted(true);
      toast({
        title: "Quote Request Submitted!",
        description: "We'll connect you with top contractors in your area within 1 hour.",
      });
      form.reset();
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit quote request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: QuoteFormData) => {
    submitQuoteMutation.mutate(data);
  };

  if (isSubmitted) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Request Submitted!</h3>
        <p className="text-gray-300 mb-4">
          We'll connect you with the top 3 contractors in your area within 1 hour.
        </p>
        <Button
          onClick={() => setIsSubmitted(false)}
          variant="outline"
          className="border-navy-500 text-gray-300 hover:bg-navy-600"
        >
          Submit Another Request
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className={compact ? "grid grid-cols-2 gap-4" : "grid grid-cols-1 md:grid-cols-2 gap-4"}>
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-300">First Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="John"
                    {...field}
                    className="bg-navy-700 border-navy-600 text-white placeholder-gray-400"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-300">Last Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Smith"
                    {...field}
                    className="bg-navy-700 border-navy-600 text-white placeholder-gray-400"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className={compact ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 md:grid-cols-2 gap-4"}>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-300">Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="john@example.com"
                    {...field}
                    className="bg-navy-700 border-navy-600 text-white placeholder-gray-400"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-300">Phone</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    placeholder="(555) 123-4567"
                    {...field}
                    className="bg-navy-700 border-navy-600 text-white placeholder-gray-400"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className={compact ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 md:grid-cols-2 gap-4"}>
          <FormField
            control={form.control}
            name="county"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-300">Area</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                      <SelectValue placeholder="Select your area" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-navy-700 border-navy-600">
                    {counties.map((county: any) => (
                      <SelectItem key={county.id} value={county.id} className="text-white hover:bg-navy-600">
                        {county.name}
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
            name="projectType"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-300">Project Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                      <SelectValue placeholder="Select project type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-navy-700 border-navy-600">
                    {Array.isArray(trades) && trades.map((trade: any) => (
                      <SelectItem key={trade.id} value={trade.id} className="text-white hover:bg-navy-600">
                        {trade.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="timeline"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-gray-300">Project Timeline</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                    <SelectValue placeholder="When do you want to start?" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-navy-700 border-navy-600">
                  <SelectItem value="asap" className="text-white hover:bg-navy-600">As soon as possible</SelectItem>
                  <SelectItem value="1-month" className="text-white hover:bg-navy-600">Within 1 month</SelectItem>
                  <SelectItem value="3-months" className="text-white hover:bg-navy-600">Within 3 months</SelectItem>
                  <SelectItem value="6-months" className="text-white hover:bg-navy-600">Within 6 months</SelectItem>
                  <SelectItem value="planning" className="text-white hover:bg-navy-600">Just planning/getting quotes</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {!compact && (
          <FormField
            control={form.control}
            name="projectDescription"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-300">Project Description (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Tell us more about your project..."
                    {...field}
                    className="bg-navy-700 border-navy-600 text-white placeholder-gray-400 min-h-[100px]"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <Button
          type="submit"
          className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 font-semibold glow-effect"
          disabled={submitQuoteMutation.isPending}
        >
          {submitQuoteMutation.isPending ? "Submitting..." : "Get My Free Quotes"}
        </Button>
      </form>
    </Form>
  );
}