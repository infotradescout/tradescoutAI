import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Gift, Trophy } from "lucide-react";

interface ConstructionEmblemProps {
  className?: string;
}

// 20 different construction-related emblems as SVG components
const constructionEmblems = [
  // Hard Hat
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <path d="M20 55 Q20 35 50 35 Q80 35 80 55 L75 65 L25 65 Z" fill="currentColor"/>
      <rect x="47" y="30" width="6" height="8" fill="currentColor"/>
      <rect x="20" y="65" width="60" height="6" fill="currentColor" rx="3"/>
    </svg>
  ),
  
  // Hammer
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <rect x="20" y="35" width="25" height="12" fill="currentColor" rx="3"/>
      <rect x="42" y="39" width="35" height="4" fill="currentColor" rx="1"/>
    </svg>
  ),

  // Wrench
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <path d="M30 25 Q25 25 25 30 L25 40 Q25 45 30 45 L35 45 L45 55 L55 45 L60 45 Q65 45 65 40 L65 30 Q65 25 60 25 Z" fill="currentColor"/>
      <rect x="45" y="50" width="10" height="25" fill="currentColor" rx="2"/>
    </svg>
  ),

  // Screwdriver
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <rect x="47" y="20" width="6" height="35" fill="currentColor" rx="1"/>
      <rect x="45" y="55" width="10" height="20" fill="currentColor" rx="2"/>
      <circle cx="50" cy="75" r="3" fill="currentColor"/>
    </svg>
  ),

  // Drill
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <rect x="25" y="40" width="40" height="15" fill="currentColor" rx="7"/>
      <rect x="65" y="45" width="8" height="5" fill="currentColor"/>
      <circle cx="30" cy="47.5" r="2" fill="white"/>
      <rect x="73" y="46" width="4" height="3" fill="currentColor"/>
    </svg>
  ),

  // Saw
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <circle cx="50" cy="50" r="25" fill="none" stroke="currentColor" strokeWidth="3"/>
      <path d="M30 45 L35 40 L40 45 L45 40 L50 45 L55 40 L60 45 L65 40 L70 45" stroke="currentColor" strokeWidth="2" fill="none"/>
      <circle cx="50" cy="50" r="3" fill="currentColor"/>
    </svg>
  ),

  // Level Tool
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <rect x="20" y="45" width="60" height="10" fill="currentColor" rx="5"/>
      <circle cx="50" cy="50" r="4" fill="white"/>
      <circle cx="50" cy="50" r="2" fill="currentColor"/>
    </svg>
  ),

  // Measuring Tape
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <rect x="30" y="35" width="40" height="25" fill="currentColor" rx="12"/>
      <rect x="35" y="40" width="30" height="3" fill="white"/>
      <rect x="35" y="45" width="20" height="2" fill="white"/>
      <rect x="35" y="48" width="25" height="2" fill="white"/>
      <rect x="35" y="51" width="15" height="2" fill="white"/>
      <rect x="35" y="54" width="30" height="2" fill="white"/>
    </svg>
  ),

  // Pliers
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <path d="M40 25 Q35 25 35 30 L35 45 L45 55 L50 50 L55 55 L65 45 L65 30 Q65 25 60 25 Z" fill="currentColor"/>
      <circle cx="42.5" cy="52.5" r="2" fill="white"/>
      <circle cx="57.5" cy="52.5" r="2" fill="white"/>
    </svg>
  ),

  // Building Crane
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <rect x="47" y="30" width="6" height="50" fill="currentColor"/>
      <rect x="25" y="25" width="50" height="4" fill="currentColor"/>
      <rect x="22" y="29" width="8" height="3" fill="currentColor"/>
      <line x1="45" y1="30" x2="35" y2="40" stroke="currentColor" strokeWidth="2"/>
      <rect x="30" y="75" width="40" height="8" fill="currentColor"/>
    </svg>
  ),

  // Blueprint Compass
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <circle cx="50" cy="50" r="25" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5,3"/>
      <line x1="50" y1="25" x2="50" y2="35" stroke="currentColor" strokeWidth="3"/>
      <line x1="50" y1="65" x2="50" y2="75" stroke="currentColor" strokeWidth="3"/>
      <circle cx="50" cy="50" r="3" fill="currentColor"/>
    </svg>
  ),

  // Gear
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <path d="M50 25 L55 30 L60 25 L65 30 L70 35 L65 40 L70 45 L65 50 L70 55 L65 60 L60 65 L55 60 L50 65 L45 60 L40 65 L35 60 L30 55 L35 50 L30 45 L35 40 L30 35 L35 30 L40 25 L45 30 Z" fill="currentColor"/>
      <circle cx="50" cy="50" r="10" fill="white"/>
      <circle cx="50" cy="50" r="4" fill="currentColor"/>
    </svg>
  ),

  // Toolbox
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <rect x="25" y="45" width="50" height="25" fill="currentColor" rx="3"/>
      <rect x="45" y="35" width="10" height="15" fill="currentColor" rx="2"/>
      <rect x="30" y="50" width="6" height="3" fill="white"/>
      <rect x="40" y="50" width="6" height="3" fill="white"/>
      <rect x="54" y="50" width="6" height="3" fill="white"/>
      <rect x="64" y="50" width="6" height="3" fill="white"/>
    </svg>
  ),

  // Safety Cone
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <path d="M50 25 L65 70 L35 70 Z" fill="currentColor"/>
      <rect x="32" y="70" width="36" height="6" fill="currentColor" rx="3"/>
      <rect x="42" y="40" width="16" height="3" fill="white"/>
      <rect x="40" y="55" width="20" height="3" fill="white"/>
    </svg>
  ),

  // Brick and Trowel
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <rect x="30" y="55" width="15" height="8" fill="currentColor"/>
      <rect x="48" y="55" width="15" height="8" fill="currentColor"/>
      <rect x="66" y="55" width="12" height="8" fill="currentColor"/>
      <rect x="39" y="47" width="15" height="8" fill="currentColor"/>
      <rect x="57" y="47" width="15" height="8" fill="currentColor"/>
      <path d="M25 35 Q20 35 20 40 L25 45 L45 35 L40 30 Q35 30 35 35 Z" fill="currentColor"/>
    </svg>
  ),

  // Pipe Wrench
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <rect x="25" y="45" width="45" height="8" fill="currentColor" rx="4"/>
      <rect x="20" y="40" width="8" height="18" fill="currentColor" rx="4"/>
      <rect x="68" y="42" width="8" height="14" fill="currentColor" rx="4"/>
      <circle cx="35" cy="49" r="2" fill="white"/>
    </svg>
  ),

  // Power Drill Bit
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <rect x="47" y="25" width="6" height="50" fill="currentColor" rx="3"/>
      <path d="M48 70 L50 75 L52 70" fill="currentColor"/>
      <rect x="45" y="30" width="10" height="8" fill="currentColor" rx="2"/>
    </svg>
  ),

  // Construction Vehicle
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <rect x="20" y="45" width="40" height="20" fill="currentColor" rx="3"/>
      <rect x="55" y="50" width="20" height="10" fill="currentColor" rx="2"/>
      <circle cx="30" cy="68" r="6" fill="currentColor"/>
      <circle cx="65" cy="68" r="6" fill="currentColor"/>
      <circle cx="30" cy="68" r="3" fill="white"/>
      <circle cx="65" cy="68" r="3" fill="white"/>
    </svg>
  ),

  // Caution Sign
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <path d="M50 25 L70 65 L30 65 Z" fill="currentColor"/>
      <rect x="47" y="35" width="6" height="15" fill="white"/>
      <circle cx="50" cy="55" r="3" fill="white"/>
    </svg>
  ),

  // Multi-tool
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <rect x="45" y="40" width="10" height="20" fill="currentColor" rx="5"/>
      <rect x="42" y="30" width="4" height="15" fill="currentColor" rx="2"/>
      <rect x="54" y="30" width="4" height="15" fill="currentColor" rx="2"/>
      <rect x="48" y="25" width="4" height="20" fill="currentColor" rx="2"/>
      <circle cx="50" cy="50" r="2" fill="white"/>
    </svg>
  )
];

export function ConstructionEmblem({ className = "" }: ConstructionEmblemProps) {
  const [currentEmblemIndex, setCurrentEmblemIndex] = useState(0);
  const [isGolden, setIsGolden] = useState(false);
  const [showPrizeDialog, setShowPrizeDialog] = useState(false);
  const [wonPrize, setWonPrize] = useState<any>(null);
  const { toast } = useToast();

  // Fetch available prizes from admin configuration
  const { data: prizes = [] } = useQuery({
    queryKey: ["/api/admin/prizes"],
    retry: false,
  });

  // Fetch golden emblem settings
  const { data: siteSettings = [] } = useQuery({
    queryKey: ["/api/admin/site-settings"],
    retry: false,
  });

  // Get golden emblem probability from admin settings (default 0.5%)
  const goldenSettings = (siteSettings as any[]).find(setting => 
    setting.category === "features" && setting.key === "golden_emblem_enabled"
  );
  const goldenProbability = goldenSettings?.value?.probability || 0.001; // 0.1% default (1 in 1000)

  // Check for golden emblem on page visit (1 in 1000 chance)
  useEffect(() => {
    // Only check for golden emblem once per component mount (page visit)
    const isGoldenRoll = Math.random() < goldenProbability;
    setIsGolden(isGoldenRoll);
    
    if (isGoldenRoll && !showPrizeDialog) {
      handleGoldenEmblemClick();
    }
  }, [goldenProbability, showPrizeDialog]);

  useEffect(() => {
    // Rotate emblem every 8 seconds (separate from golden emblem logic)
    const interval = setInterval(() => {
      const nextIndex = Math.floor(Math.random() * constructionEmblems.length);
      setCurrentEmblemIndex(nextIndex);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  const handleGoldenEmblemClick = () => {
    if (!isGolden) return;
    
    // Select a random prize from available prizes
    const activePrizes = (prizes as any[]).filter(prize => prize.isActive);
    if (activePrizes.length === 0) {
      toast({
        title: "Golden Emblem!",
        description: "You found a rare golden emblem! Unfortunately, no prizes are currently configured.",
        variant: "default",
      });
      return;
    }

    // Weighted random selection based on probability
    const totalWeight = activePrizes.reduce((sum, prize) => sum + parseFloat(prize.probability), 0);
    let random = Math.random() * totalWeight;
    
    let selectedPrize = activePrizes[0];
    for (const prize of activePrizes) {
      random -= parseFloat(prize.probability);
      if (random <= 0) {
        selectedPrize = prize;
        break;
      }
    }

    setWonPrize(selectedPrize);
    setShowPrizeDialog(true);
    
    toast({
      title: "🎉 Golden Emblem Found!",
      description: `Congratulations! You won: ${selectedPrize.name}`,
      variant: "default",
    });
  };

  const handleClaimPrize = () => {
    if (wonPrize) {
      toast({
        title: "Prize Claimed!",
        description: `Your ${wonPrize.name} has been recorded. Check your email for redemption details.`,
        variant: "default",
      });
    }
    setShowPrizeDialog(false);
    setIsGolden(false);
    setWonPrize(null);
  };

  const EmblemComponent = constructionEmblems[currentEmblemIndex];

  return (
    <>
      <div 
        className={`${className} relative transition-all duration-500 ${
          isGolden ? 'animate-pulse cursor-pointer transform scale-110' : ''
        }`}
        onClick={isGolden ? handleGoldenEmblemClick : undefined}
        style={{
          color: isGolden ? '#FFD700' : '#F97316',
          filter: isGolden ? 'drop-shadow(0 0 8px #FFD700)' : 'none'
        }}
      >
        <EmblemComponent />
        {isGolden && (
          <div className="absolute -top-1 -right-1">
            <Sparkles className="w-4 h-4 text-yellow-400 animate-pulse" />
          </div>
        )}
      </div>

      {/* Prize Dialog */}
      <Dialog open={showPrizeDialog} onOpenChange={setShowPrizeDialog}>
        <DialogContent className="bg-slate-900 text-white max-w-md border-yellow-500">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-400">
              <Trophy className="w-6 h-6" />
              Congratulations! 🎉
            </DialogTitle>
          </DialogHeader>
          
          {wonPrize && (
            <Card className="bg-yellow-900/20 border-yellow-500/30">
              <CardContent className="p-4 text-center">
                <div className="flex justify-center mb-3">
                  <Gift className="w-12 h-12 text-yellow-400" />
                </div>
                <h3 className="text-lg font-semibold text-yellow-100 mb-2">
                  {wonPrize.name}
                </h3>
                <p className="text-gray-300 text-sm mb-3">
                  {wonPrize.description}
                </p>
                <div className="bg-slate-800 p-3 rounded-lg mb-4">
                  <div className="text-yellow-400 text-xl font-bold">
                    {wonPrize.value}
                  </div>
                  {wonPrize.vendor && (
                    <div className="text-gray-400 text-sm">
                      from {wonPrize.vendor}
                    </div>
                  )}
                </div>
                {wonPrize.terms && (
                  <p className="text-xs text-gray-400 mb-4">
                    {wonPrize.terms}
                  </p>
                )}
                <Button 
                  onClick={handleClaimPrize}
                  className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  Claim Prize
                </Button>
              </CardContent>
            </Card>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}