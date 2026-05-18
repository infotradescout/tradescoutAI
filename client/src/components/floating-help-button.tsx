import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, X, BookOpen, Play, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useHelpSystemContext } from "@/components/help-system-provider";

export function FloatingHelpButton() {
  const [isOpen, setIsOpen] = useState(false);
  // Simple help system to avoid hook errors
  const helpSystem = {
    config: { enableTooltips: true, contextualHints: true, showOnboardingTour: false },
    updateConfig: () => {},
    startTour: () => {},
    tours: {},
  };
  const context = useHelpSystemContext?.();
  const { config, updateConfig, startTour } = context || helpSystem;

  const safeStartTour = (id?: string) => {
    const fn = startTour as unknown as ((id?: string) => void) | undefined;
    fn?.(id);
  };

  const safeUpdateConfig = (opts: Record<string, any>) => {
    const fn = updateConfig as unknown as ((opts: Record<string, any>) => void) | undefined;
    fn?.(opts);
  };

  const helpOptions = [
    {
      id: "contractor-search",
      title: "Local Help Tour",
      description: "Learn how to find and connect with local businesses",
      icon: <Play className="w-4 h-4" />,
      available: true,
    },
    {
      id: "daily-deals",
      title: "TradeDeals Tour",
      description: "See how exclusive TradeDeals support real projects",
      icon: <Play className="w-4 h-4" />,
      available: true,
    },
    {
      id: "groups",
      title: "Groups Tour",
      description: "Join community discussions and groups",
      icon: <Play className="w-4 h-4" />,
      available: true,
    },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50" data-testid="floating-help">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="absolute bottom-16 right-0 w-80"
          >
            <Card className="ts-surface border-white/15 bg-white/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">TradeScout Help</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Tour Options */}
                <div className="space-y-2 mb-4">
                  <h4 className="text-sm font-medium text-white/70">Interactive Tours</h4>
                  {helpOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => {
                        safeStartTour(option.id);
                        setIsOpen(false);
                      }}
                      className="w-full text-left p-2 rounded hover:bg-white/10 transition-colors group"
                      disabled={!option.available}
                    >
                      <div className="flex items-start space-x-2">
                        <div className="text-blue-400 mt-0.5">{option.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white group-hover:text-blue-400">
                            {option.title}
                          </div>
                          <div className="text-xs text-white/60">{option.description}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Settings */}
                <div className="pt-2 border-t border-white/10">
                  <h4 className="text-sm font-medium text-white/70 mb-2">Help Settings</h4>
                  <div className="space-y-2 text-sm">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.enableTooltips}
                        onChange={(e) => safeUpdateConfig({ enableTooltips: e.target.checked })}
                        className="rounded border-white/15 bg-white/10 text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-white/70">Enable tooltips</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.contextualHints}
                        onChange={(e) => safeUpdateConfig({ contextualHints: e.target.checked })}
                        className="rounded border-white/15 bg-white/10 text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-white/70">Show contextual hints</span>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 bg-blue-600 hover:bg-blue-700 rounded-full shadow-lg flex items-center justify-center text-white"
        data-testid="help-button"
      >
        <HelpCircle className="w-6 h-6" />
      </motion.button>

      {/* Pulsing indicator for new users */}
      {config.showOnboardingTour && (
        <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-75" />
      )}
    </div>
  );
}
