import { useState, useEffect } from "react";
import { ContextualTooltip } from "@/components/ui/contextual-tooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  HelpCircle,
  Lightbulb,
  Wrench,
  Hammer,
  HardHat,
  BookOpen,
  Video,
  MessageCircle,
  Zap,
  ChevronRight,
} from "lucide-react";

interface HelpTopic {
  id: string;
  title: string;
  description: string;
  category: "getting-started" | "features" | "troubleshooting" | "best-practices";
  illustration: "wrench" | "hammer" | "hardhat" | "drill" | "screwdriver" | "paintbrush" | "ruler";
  content: {
    overview: string;
    steps?: string[];
    tips?: string[];
    wittyNote?: string;
  };
}

const helpTopics: HelpTopic[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    description: "New to TradeScout? We'll get your business surface ready fast.",
    category: "getting-started",
    illustration: "hardhat",
    content: {
      overview:
        "Welcome to TradeScout! Think of us as your digital toolbox for connecting with customers and growing your business.",
      steps: [
        "Complete your business profile so customers can inspect your offer before acting",
        "Upload your best proof, product, or work photos",
        "Set your service areas so customers know where you operate",
        "Configure your availability and fixed-price offers",
      ],
      tips: [
        "A complete profile gets 3x more customer inquiries",
        "High-quality photos increase conversion by 40%",
        "Responding within 2 hours improves your success rate",
      ],
      wittyNote: "Scout can walk you through profile, offers, verification, and books setup.",
    },
  },
  {
    id: "project-tracker",
    title: "Managing Customer Requests",
    description: "Handle customer inquiries and orders without losing the thread.",
    category: "features",
    illustration: "wrench",
    content: {
      overview:
        "Direct Connect and profile purchases keep requests, orders, receipts, and review steps in one place.",
      steps: [
        "Receive notifications when customers request quotes",
        "Review project details and customer requirements",
        "Send professional quotes using our calculator",
        "Follow up with customers through our messaging system",
      ],
      tips: [
        "Quick responses and clear boundaries win trust",
        "Ask clarifying questions to provide accurate quotes",
        "Use our templates to save time on common projects",
      ],
      wittyNote: "TradeScout keeps the next step visible without bypassing customer approval.",
    },
  },
  {
    id: "quote-calculator",
    title: "Using Scout for Estimates",
    description:
      "Let Scout help you price work, products, materials, and estimates with clearer context.",
    category: "features",
    illustration: "ruler",
    content: {
      overview:
        "Scout combines your project details with local pricing context to help you quote with confidence and route you into the right quoting tools.",
      steps: [
        "Tell Scout what you're planning (project type and scope)",
        "Answer Scout's quick questions about size, materials, and timing so it can set things up correctly",
        "Review the suggested ranges and trade-offs",
        "Use Scout's guidance to send a professional quote to the customer",
      ],
      tips: [
        "Include buffer time for unexpected issues",
        "Factor in permit and inspection costs for larger projects",
        "Don't forget to account for cleanup, disposal, and travel time",
      ],
      wittyNote: "Scout helps turn rough intent into a reviewable quote, material list, or offer.",
    },
  },
  {
    id: "profile-optimization",
    title: "Optimizing Your Profile",
    description: "Make your profile, proof, and offers work harder for your business.",
    category: "best-practices",
    illustration: "paintbrush",
    content: {
      overview: "Your profile is your storefront - keep it looking professional and inviting.",
      steps: [
        "Write a compelling bio that shows your personality",
        "Showcase your best work with high-quality photos",
        "List all your services and specialties",
        "Keep your contact information and availability current",
      ],
      tips: [
        "Use natural lighting for work photos",
        "Include before and after shots when possible",
        "Mention any certifications or specializations",
        "Update your profile seasonally with relevant services",
      ],
      wittyNote:
        "A great profile helps customers understand what you sell and why they can trust it.",
    },
  },
  {
    id: "troubleshooting",
    title: "Common Issues",
    description: "Fix problems faster than a leaky pipe on a Sunday.",
    category: "troubleshooting",
    illustration: "screwdriver",
    content: {
      overview: "Most issues have simple solutions - like checking if it's plugged in first.",
      steps: [
        "Check your internet connection",
        "Clear your browser cache and cookies",
        "Try logging out and back in",
        "Contact support if problems persist",
      ],
      tips: [
        "Keep your browser updated for best performance",
        "Use Chrome or Firefox for optimal experience",
        "Screenshots help our support team diagnose issues faster",
      ],
      wittyNote:
        "Troubleshooting TradeScout is easier than fixing that one electrical outlet that never worked right – and if you get stuck, Scout can point you to the right place.",
    },
  },
];

interface ContextualHelpProps {
  topic?: string;
  compact?: boolean;
}

export function ContextualHelp({ topic, compact = false }: ContextualHelpProps) {
  const [selectedTopic, setSelectedTopic] = useState<HelpTopic | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const relevantTopic = topic ? helpTopics.find((t) => t.id === topic) : null;

  if (compact && relevantTopic) {
    return (
      <ContextualTooltip
        title={relevantTopic.title}
        content={relevantTopic.description}
        illustration={relevantTopic.illustration}
        variant="contractor"
      />
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-ts-orange hover:text-ts-orange hover:bg-tsCard"
        >
          <HelpCircle className="h-4 w-4 mr-2" />
          Help
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl bg-tsCard border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center text-ts-orange">
            <Lightbulb className="h-5 w-5 mr-2" />
            TradeScout Help Center
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="topics" className="w-full">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 bg-tsCard">
            <TabsTrigger value="topics" className="data-[state=active]:bg-ts-orange">
              All Topics
            </TabsTrigger>
            <TabsTrigger value="quick-tips" className="data-[state=active]:bg-ts-orange">
              Quick Tips
            </TabsTrigger>
            <TabsTrigger value="contact" className="data-[state=active]:bg-ts-orange">
              Get Support
            </TabsTrigger>
          </TabsList>

          <TabsContent value="topics" className="space-y-4 max-h-96 overflow-y-auto">
            <div className="grid gap-3">
              {helpTopics.map((helpTopic) => (
                <Card
                  key={helpTopic.id}
                  className="bg-tsCard border-white/10 hover:border-ts-orange/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedTopic(helpTopic)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className="bg-ts-orange/20 p-2 rounded">
                          {helpTopic.illustration === "hardhat" && (
                            <HardHat className="h-5 w-5 text-ts-orange" />
                          )}
                          {helpTopic.illustration === "wrench" && (
                            <Wrench className="h-5 w-5 text-ts-orange" />
                          )}
                          {helpTopic.illustration === "hammer" && (
                            <Hammer className="h-5 w-5 text-ts-orange" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-white mb-1">{helpTopic.title}</h3>
                          <p className="text-sm text-white/70">{helpTopic.description}</p>
                          <Badge variant="outline" className="mt-2 text-xs">
                            {helpTopic.category.replace("-", " ")}
                          </Badge>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-white/60" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="quick-tips" className="space-y-4">
            <div className="grid gap-3">
              <Card className="bg-tsCard border-white/10">
                <CardHeader>
                  <CardTitle className="text-ts-orange flex items-center">
                    <Zap className="h-5 w-5 mr-2" />
                    Pro Tips for Success
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="bg-green-500/20 p-1 rounded">
                      <span className="text-green-400 text-sm">💡</span>
                    </div>
                    <p className="text-sm text-white/70">
                      Respond to customer requests within 15 minutes - you'll win 80% more jobs than
                      slow responders.
                    </p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="bg-blue-500/20 p-1 rounded">
                      <span className="text-blue-400 text-sm">📸</span>
                    </div>
                    <p className="text-sm text-white/70">
                      Upload 8-12 high-quality photos - profiles with more photos get viewed 5x
                      more.
                    </p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="bg-purple-500/20 p-1 rounded">
                      <span className="text-white/70 text-xs font-semibold">CVS</span>
                    </div>
                    <p className="text-sm text-white/70">
                      Ask satisfied customers for recommendations. Most homeowners read
                      recommendations before hiring.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="contact" className="space-y-4">
            <div className="grid gap-4">
              <Card className="bg-tsCard border-white/10">
                <CardContent className="p-6 text-center">
                  <MessageCircle className="h-12 w-12 text-ts-orange mx-auto mb-4" />
                  <h3 className="font-semibold text-white mb-2">Need Personal Help?</h3>
                  <p className="text-white/70 mb-4">
                    Our support team knows construction better than your local building inspector.
                  </p>
                  <Button className="bg-ts-orange hover:bg-ts-orange-dark">Contact Support</Button>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="bg-tsCard border-white/10">
                  <CardContent className="p-4 text-center">
                    <BookOpen className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                    <h4 className="font-medium text-white">Documentation</h4>
                    <p className="text-xs text-white/60">Detailed guides</p>
                  </CardContent>
                </Card>

                <Card className="bg-tsCard border-white/10">
                  <CardContent className="p-4 text-center">
                    <Video className="h-8 w-8 text-green-400 mx-auto mb-2" />
                    <h4 className="font-medium text-white">Video Tutorials</h4>
                    <p className="text-xs text-white/60">Step-by-step videos</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Topic Detail Modal */}
        {selectedTopic && (
          <Dialog open={!!selectedTopic} onOpenChange={() => setSelectedTopic(null)}>
            <DialogContent className="max-w-[95vw] sm:max-w-3xl bg-tsCard border-white/10 text-white">
              <DialogHeader>
                <DialogTitle className="flex items-center text-ts-orange">
                  {selectedTopic.illustration === "hardhat" && <HardHat className="h-5 w-5 mr-2" />}
                  {selectedTopic.illustration === "wrench" && <Wrench className="h-5 w-5 mr-2" />}
                  {selectedTopic.illustration === "hammer" && <Hammer className="h-5 w-5 mr-2" />}
                  {selectedTopic.title}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <p className="text-white/70">{selectedTopic.content.overview}</p>

                {selectedTopic.content.steps && (
                  <div>
                    <h4 className="font-semibold text-ts-orange mb-2">Steps:</h4>
                    <ol className="list-decimal list-inside space-y-1 text-white/70">
                      {selectedTopic.content.steps.map((step, index) => (
                        <li key={index} className="text-sm">
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {selectedTopic.content.tips && (
                  <div>
                    <h4 className="font-semibold text-ts-orange mb-2">Pro Tips:</h4>
                    <ul className="list-disc list-inside space-y-1 text-white/70">
                      {selectedTopic.content.tips.map((tip, index) => (
                        <li key={index} className="text-sm">
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedTopic.content.wittyNote && (
                  <div className="bg-ts-orange/10 border border-ts-orange/30 rounded p-3">
                    <p className="text-sm text-ts-orange italic">
                      💡 {selectedTopic.content.wittyNote}
                    </p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
