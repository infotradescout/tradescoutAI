import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessagingTooltip, ContextualTooltip } from "@/components/ui/contextual-tooltip";
import { Send, ClipboardList, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const contactFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional(),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  message: z.string().min(20, "Message must be at least 20 characters"),
  projectType: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

interface ContactFormProps {
  contractorId?: string;
  className?: string;
  variant?: "default" | "compact";
}

export function ContactForm({
  contractorId,
  className = "",
  variant = "default",
}: ContactFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      subject: "",
      message: "",
      projectType: "",
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    try {
      // Submit to Formspree endpoint
      const response = await fetch("https://formspree.io/f/YOUR_FORM_ID", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone,
          subject: data.subject,
          message: data.message,
          projectType: data.projectType,
          contractorId: contractorId || null,
          source: "TradeScout Contact Form",
        }),
      });

      if (response.ok) {
        console.log("Contact form submitted successfully:", data);
        form.reset();
        toast({
          title: "Message Sent!",
          description: "Thanks for reaching out! We'll get back to you soon.",
        });
      } else {
        throw new Error("Failed to submit form");
      }
    } catch (error) {
      console.error("Failed to submit contact form:", error);
      toast({
        title: "Message Failed",
        description: "There was an error sending your message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className={`bg-tsCard border border-white/10 rounded-xl shadow-[0_18px_52px_rgba(0,0,0,0.36)] ${className}`}>
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-ts-orange" />
            Get In Touch
          </div>
          <MessagingTooltip>
            <ContextualTooltip
              title="Contact Tips"
              content="Be specific about your project needs - contractors love details like square footage, timeline, and budget range."
              illustration="hammer"
              variant="contractor"
            />
          </MessagingTooltip>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/70 flex items-center gap-2">
                      Your Name
                      <ContextualTooltip
                        content="Use your real name - contractors prefer working with people, not 'HomeBuyer123'"
                        illustration="hardhat"
                        size="sm"
                        variant="contractor"
                      />
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="bg-white/5 border-white/10 text-white"
                        placeholder="John Smith"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/70 flex items-center gap-2">
                      Email Address
                      <ContextualTooltip
                        content="This is how contractors will reach you with quotes and updates"
                        illustration="wrench"
                        size="sm"
                        variant="contractor"
                      />
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        className="bg-white/5 border-white/10 text-white"
                        placeholder="john@example.com"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/70 flex items-center gap-2">
                      Phone Number (Optional)
                      <ContextualTooltip
                        content="Contractors often prefer calling for complex projects - it's faster than 20 text messages"
                        illustration="drill"
                        size="sm"
                        variant="contractor"
                      />
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="tel"
                        className="bg-white/5 border-white/10 text-white"
                        placeholder="(555) 123-4567"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="projectType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/70 flex items-center gap-2">
                      Project Type
                      <ContextualTooltip
                        content="Help contractors understand your project scope - kitchen remodel, deck repair, etc."
                        illustration="paintbrush"
                        size="sm"
                        variant="contractor"
                      />
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="bg-white/5 border-white/10 text-white"
                        placeholder="Kitchen remodel, deck repair, etc."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white/70 flex items-center gap-2">
                    Subject
                    <ContextualTooltip
                      content="A clear subject line gets faster responses - like a good tool label"
                      illustration="ruler"
                      size="sm"
                      variant="contractor"
                    />
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="bg-white/5 border-white/10 text-white"
                      placeholder="Need quote for bathroom renovation"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white/70 flex items-center gap-2">
                    Project Details
                    <MessagingTooltip>
                      <ContextualTooltip
                        title="Writing Great Project Descriptions"
                        content="Include specifics: room dimensions, current condition, desired timeline, and rough budget range. Think of it as blueprints for your request."
                        illustration="hammer"
                        variant="contractor"
                      />
                    </MessagingTooltip>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      className="bg-white/5 border-white/10 text-white min-h-32"
                      placeholder="Describe your project in detail: room size, current condition, timeline, budget range, specific requirements..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-ts-orange hover:bg-ts-orange-dark text-white px-6 py-2 flex items-center gap-2 shadow-lg shadow-ts-orange/25"
              >
                {isSubmitting ? (
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {isSubmitting ? "Sending..." : "Send Message"}
              </Button>
            </div>
          </form>
        </Form>

        {/* Request alternatives */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <p className="text-sm text-white/60 mb-3">Prefer request-based routing?</p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 text-white/60 hover:text-white"
            >
              <ClipboardList className="h-4 w-4 mr-2" />
              Request Quote
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
