import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, X, BookOpen, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export function SimpleFloatingHelp() {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const helpOptions = [
    {
      id: "contractor-search",
      title: "Find Local Help",
      description: "Learn how Direct Connect routes requests to local businesses",
    },
    {
      id: "messaging",
      title: "Request Quotes",
      description: "How request flow works before contact is granted",
    },
    {
      id: "daily-deals",
      title: "TradeDeals",
      description: "Understand how exclusive TradeDeals work",
    },
  ];

  const handleStartTour = (tourId: string) => {
    toast({ title: `Starting ${tourId} tour!` });
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="relative">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-all duration-200 hover:scale-105"
          data-testid="floating-help-button"
        >
          <HelpCircle className="w-6 h-6" />
        </Button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              className="absolute bottom-full right-0 mb-4 w-80"
            >
              <Card className="bg-white/5 border-white/15 shadow-xl">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Help & Tours</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsOpen(false)}
                      className="text-white/60 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div className="border-b border-white/15 pb-3">
                      <h4 className="text-sm font-medium text-white/70 mb-2">Quick Tours</h4>
                      <div className="space-y-2">
                        {helpOptions.map((option) => (
                          <Button
                            key={option.id}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartTour(option.title)}
                            className="w-full justify-start text-left h-auto p-2 text-white hover:bg-white/10"
                          >
                            <div className="flex items-center space-x-2">
                              <Play className="w-4 h-4 text-blue-400" />
                              <div>
                                <div className="font-medium">{option.title}</div>
                                <div className="text-xs text-white/60">{option.description}</div>
                              </div>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-white/15 text-white/70 hover:bg-white/10"
                      onClick={() => {
                        toast({ title: "Opening help center..." });
                        setIsOpen(false);
                      }}
                    >
                      <BookOpen className="w-4 h-4 mr-2" />
                      View Help Center
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
