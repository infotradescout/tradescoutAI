import { useState, useEffect } from "react";
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
  // Hammer and Wrench Crossed
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <path d="M25 35 L35 25 L45 35 L75 65 L65 75 L35 45 Z" fill="currentColor"/>
      <path d="M55 25 L65 35 L75 25 L85 35 L75 45 L65 55 L55 45 L45 35 Z" fill="currentColor"/>
      <circle cx="40" cy="60" r="3" fill="currentColor"/>
      <circle cx="60" cy="40" r="3" fill="currentColor"/>
    </svg>
  ),
  
  // Hard Hat with Tools
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <path d="M20 55 Q20 35 50 35 Q80 35 80 55 L75 65 L25 65 Z" fill="currentColor"/>
      <rect x="47" y="30" width="6" height="8" fill="currentColor"/>
      <path d="M30 70 L35 75 L40 70" stroke="currentColor" strokeWidth="2" fill="none"/>
      <path d="M60 70 L65 75 L70 70" stroke="currentColor" strokeWidth="2" fill="none"/>
    </svg>
  ),

  // Blueprint Compass
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5,3"/>
      <line x1="50" y1="20" x2="50" y2="35" stroke="currentColor" strokeWidth="3"/>
      <line x1="50" y1="65" x2="50" y2="80" stroke="currentColor" strokeWidth="3"/>
      <line x1="20" y1="50" x2="35" y2="50" stroke="currentColor" strokeWidth="3"/>
      <line x1="65" y1="50" x2="80" y2="50" stroke="currentColor" strokeWidth="3"/>
      <circle cx="50" cy="50" r="5" fill="currentColor"/>
      <path d="M45 45 L55 35 L55 40 L75 40 L75 60 L55 60 L55 65 Z" fill="currentColor"/>
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
      <line x1="55" y1="30" x2="65" y2="40" stroke="currentColor" strokeWidth="2"/>
      <rect x="30" y="75" width="40" height="8" fill="currentColor"/>
    </svg>
  ),

  // Gear and Bolt
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <path d="M50 25 L55 30 L60 25 L65 30 L70 35 L65 40 L70 45 L65 50 L70 55 L65 60 L60 65 L55 60 L50 65 L45 60 L40 65 L35 60 L30 55 L35 50 L30 45 L35 40 L30 35 L35 30 L40 25 L45 30 Z" fill="currentColor"/>
      <circle cx="50" cy="50" r="12" fill="white"/>
      <circle cx="50" cy="50" r="5" fill="currentColor"/>
      <rect x="72" y="35" width="3" height="15" fill="currentColor" rx="1.5"/>
      <circle cx="73.5" cy="32" r="2" fill="currentColor"/>
      <circle cx="73.5" cy="53" r="2" fill="currentColor"/>
    </svg>
  ),

  // Level Tool
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <rect x="20" y="45" width="60" height="10" fill="currentColor" rx="5"/>
      <rect x="25" y="47" width="50" height="6" fill="white" rx="3"/>
      <circle cx="50" cy="50" r="8" fill="currentColor"/>
      <circle cx="50" cy="50" r="4" fill="white"/>
      <line x1="47" y1="47" x2="53" y2="53" stroke="currentColor" strokeWidth="1"/>
      <circle cx="35" cy="50" r="2" fill="currentColor"/>
      <circle cx="65" cy="50" r="2" fill="currentColor"/>
    </svg>
  ),

  // Drill Bit
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <rect x="25" y="47" width="40" height="6" fill="currentColor"/>
      <path d="M65 47 L75 50 L65 53 Z" fill="currentColor"/>
      <rect x="20" y="45" width="8" height="10" fill="currentColor" rx="2"/>
      <line x1="30" y1="48" x2="35" y2="48" stroke="white" strokeWidth="1"/>
      <line x1="30" y1="52" x2="35" y2="52" stroke="white" strokeWidth="1"/>
      <line x1="40" y1="48" x2="60" y2="48" stroke="white" strokeWidth="1"/>
      <line x1="40" y1="52" x2="60" y2="52" stroke="white" strokeWidth="1"/>
    </svg>
  ),

  // Measuring Tape
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <circle cx="40" cy="45" r="18" fill="currentColor"/>
      <circle cx="40" cy="45" r="12" fill="white"/>
      <circle cx="40" cy="45" r="3" fill="currentColor"/>
      <path d="M55 40 Q70 35 75 50 Q70 65 55 60" stroke="currentColor" strokeWidth="4" fill="none"/>
      <rect x="72" y="48" width="6" height="4" fill="currentColor"/>
      <line x1="35" y1="40" x2="45" y2="40" stroke="currentColor" strokeWidth="1"/>
      <line x1="35" y1="45" x2="45" y2="45" stroke="currentColor" strokeWidth="1"/>
      <line x1="35" y1="50" x2="45" y2="50" stroke="currentColor" strokeWidth="1"/>
    </svg>
  ),

  // Saw Blade
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <circle cx="50" cy="50" r="25" fill="currentColor"/>
      <circle cx="50" cy="50" r="15" fill="white"/>
      <circle cx="50" cy="50" r="4" fill="currentColor"/>
      <path d="M25 50 L22 47 L22 53 Z" fill="currentColor"/>
      <path d="M75 50 L78 47 L78 53 Z" fill="currentColor"/>
      <path d="M50 25 L47 22 L53 22 Z" fill="currentColor"/>
      <path d="M50 75 L47 78 L53 78 Z" fill="currentColor"/>
      <path d="M35.5 35.5 L33 33 L38 33 Z" fill="currentColor"/>
      <path d="M64.5 64.5 L67 67 L62 67 Z" fill="currentColor"/>
      <path d="M64.5 35.5 L67 33 L62 33 Z" fill="currentColor"/>
      <path d="M35.5 64.5 L33 67 L38 67 Z" fill="currentColor"/>
    </svg>
  ),

  // Safety Cone
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <path d="M50 20 L65 75 L35 75 Z" fill="currentColor"/>
      <rect x="30" y="70" width="40" height="8" fill="currentColor" rx="4"/>
      <rect x="42" y="35" width="16" height="3" fill="white"/>
      <rect x="40" y="45" width="20" height="3" fill="white"/>
      <rect x="38" y="55" width="24" height="3" fill="white"/>
      <rect x="36" y="65" width="28" height="3" fill="white"/>
    </svg>
  ),

  // Brick Pattern
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <rect x="25" y="25" width="15" height="8" fill="currentColor" stroke="white" strokeWidth="1"/>
      <rect x="42" y="25" width="15" height="8" fill="currentColor" stroke="white" strokeWidth="1"/>
      <rect x="59" y="25" width="15" height="8" fill="currentColor" stroke="white" strokeWidth="1"/>
      <rect x="17" y="35" width="15" height="8" fill="currentColor" stroke="white" strokeWidth="1"/>
      <rect x="34" y="35" width="15" height="8" fill="currentColor" stroke="white" strokeWidth="1"/>
      <rect x="51" y="35" width="15" height="8" fill="currentColor" stroke="white" strokeWidth="1"/>
      <rect x="68" y="35" width="15" height="8" fill="currentColor" stroke="white" strokeWidth="1"/>
      <rect x="25" y="45" width="15" height="8" fill="currentColor" stroke="white" strokeWidth="1"/>
      <rect x="42" y="45" width="15" height="8" fill="currentColor" stroke="white" strokeWidth="1"/>
      <rect x="59" y="45" width="15" height="8" fill="currentColor" stroke="white" strokeWidth="1"/>
      <rect x="17" y="55" width="15" height="8" fill="currentColor" stroke="white" strokeWidth="1"/>
      <rect x="34" y="55" width="15" height="8" fill="currentColor" stroke="white" strokeWidth="1"/>
      <rect x="51" y="55" width="15" height="8" fill="currentColor" stroke="white" strokeWidth="1"/>
      <rect x="68" y="55" width="15" height="8" fill="currentColor" stroke="white" strokeWidth="1"/>
      <rect x="25" y="65" width="15" height="8" fill="currentColor" stroke="white" strokeWidth="1"/>
      <rect x="42" y="65" width="15" height="8" fill="currentColor" stroke="white" strokeWidth="1"/>
      <rect x="59" y="65" width="15" height="8" fill="currentColor" stroke="white" strokeWidth="1"/>
    </svg>
  ),

  // Screwdriver
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <rect x="20" y="47" width="45" height="6" fill="currentColor"/>
      <rect x="65" y="45" width="12" height="10" fill="currentColor" rx="2"/>
      <rect x="15" y="49" width="8" height="2" fill="currentColor"/>
      <line x1="25" y1="48" x2="60" y2="48" stroke="white" strokeWidth="0.5"/>
      <line x1="25" y1="52" x2="60" y2="52" stroke="white" strokeWidth="0.5"/>
      <rect x="67" y="47" width="8" height="6" fill="white"/>
      <circle cx="71" cy="50" r="1" fill="currentColor"/>
    </svg>
  ),

  // Paint Roller
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <rect x="35" y="20" width="30" height="12" fill="currentColor" rx="6"/>
      <rect x="47" y="32" width="6" height="25" fill="currentColor"/>
      <rect x="45" y="57" width="10" height="8" fill="currentColor" rx="2"/>
      <rect x="47" y="65" width="6" height="12" fill="currentColor"/>
      <line x1="38" y1="23" x2="38" y2="29" stroke="white" strokeWidth="1"/>
      <line x1="41" y1="23" x2="41" y2="29" stroke="white" strokeWidth="1"/>
      <line x1="44" y1="23" x2="44" y2="29" stroke="white" strokeWidth="1"/>
      <line x1="47" y1="23" x2="47" y2="29" stroke="white" strokeWidth="1"/>
      <line x1="50" y1="23" x2="50" y2="29" stroke="white" strokeWidth="1"/>
      <line x1="53" y1="23" x2="53" y2="29" stroke="white" strokeWidth="1"/>
      <line x1="56" y1="23" x2="56" y2="29" stroke="white" strokeWidth="1"/>
      <line x1="59" y1="23" x2="59" y2="29" stroke="white" strokeWidth="1"/>
      <line x1="62" y1="23" x2="62" y2="29" stroke="white" strokeWidth="1"/>
    </svg>
  ),

  // Pliers
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <path d="M30 35 Q35 30 40 35 L45 40 L40 45 Q35 50 30 45 Z" fill="currentColor"/>
      <path d="M55 40 L60 35 Q65 30 70 35 Q75 40 70 45 L65 50 L60 45 Z" fill="currentColor"/>
      <circle cx="47.5" cy="42.5" r="3" fill="currentColor"/>
      <path d="M25 65 Q30 55 35 50 L40 45" stroke="currentColor" strokeWidth="3" fill="none"/>
      <path d="M75 65 Q70 55 65 50 L60 45" stroke="currentColor" strokeWidth="3" fill="none"/>
      <line x1="42" y1="38" x2="48" y2="32" stroke="currentColor" strokeWidth="2"/>
      <line x1="52" y1="32" x2="58" y2="38" stroke="currentColor" strokeWidth="2"/>
    </svg>
  ),

  // Tool Box
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <rect x="25" y="45" width="50" height="25" fill="currentColor" rx="2"/>
      <rect x="40" y="35" width="20" height="12" fill="currentColor" rx="2"/>
      <rect x="30" y="50" width="40" height="15" fill="white"/>
      <line x1="35" y1="55" x2="40" y2="55" stroke="currentColor" strokeWidth="2"/>
      <line x1="45" y1="55" x2="50" y2="55" stroke="currentColor" strokeWidth="2"/>
      <line x1="55" y1="55" x2="60" y2="55" stroke="currentColor" strokeWidth="2"/>
      <circle cx="55" cy="42" r="2" fill="white"/>
      <rect x="20" y="67" width="60" height="3" fill="currentColor"/>
    </svg>
  ),

  // Ladder
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <rect x="35" y="15" width="4" height="70" fill="currentColor"/>
      <rect x="61" y="15" width="4" height="70" fill="currentColor"/>
      <rect x="37" y="20" width="26" height="3" fill="currentColor"/>
      <rect x="37" y="30" width="26" height="3" fill="currentColor"/>
      <rect x="37" y="40" width="26" height="3" fill="currentColor"/>
      <rect x="37" y="50" width="26" height="3" fill="currentColor"/>
      <rect x="37" y="60" width="26" height="3" fill="currentColor"/>
      <rect x="37" y="70" width="26" height="3" fill="currentColor"/>
      <rect x="37" y="80" width="26" height="3" fill="currentColor"/>
    </svg>
  ),

  // Nail
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <rect x="47" y="25" width="6" height="50" fill="currentColor"/>
      <circle cx="50" cy="23" r="8" fill="currentColor"/>
      <circle cx="50" cy="23" r="5" fill="white"/>
      <path d="M47 75 L50 78 L53 75" fill="currentColor"/>
      <line x1="45" y1="30" x2="55" y2="30" stroke="white" strokeWidth="1"/>
      <line x1="45" y1="35" x2="55" y2="35" stroke="white" strokeWidth="1"/>
      <line x1="45" y1="40" x2="55" y2="40" stroke="white" strokeWidth="1"/>
    </svg>
  ),

  // Cement Mixer
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <circle cx="50" cy="45" r="20" fill="currentColor"/>
      <circle cx="50" cy="45" r="15" fill="white"/>
      <rect x="47" y="25" width="6" height="15" fill="currentColor"/>
      <rect x="40" y="20" width="20" height="8" fill="currentColor" rx="4"/>
      <circle cx="35" cy="70" r="8" fill="currentColor"/>
      <circle cx="65" cy="70" r="8" fill="currentColor"/>
      <circle cx="35" cy="70" r="4" fill="white"/>
      <circle cx="65" cy="70" r="4" fill="white"/>
      <rect x="45" y="62" width="10" height="8" fill="currentColor"/>
      <path d="M30 62 Q50 55 70 62" stroke="currentColor" strokeWidth="3" fill="none"/>
    </svg>
  ),

  // Blueprint
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <rect x="25" y="25" width="50" height="40" fill="currentColor" stroke="white" strokeWidth="2"/>
      <rect x="30" y="30" width="15" height="10" fill="none" stroke="white" strokeWidth="1"/>
      <rect x="50" y="30" width="15" height="10" fill="none" stroke="white" strokeWidth="1"/>
      <rect x="30" y="45" width="15" height="15" fill="none" stroke="white" strokeWidth="1"/>
      <rect x="50" y="45" width="15" height="15" fill="none" stroke="white" strokeWidth="1"/>
      <line x1="30" y1="72" x2="70" y2="72" stroke="white" strokeWidth="1"/>
      <line x1="30" y1="75" x2="50" y2="75" stroke="white" strokeWidth="1"/>
      <line x1="55" y1="75" x2="70" y2="75" stroke="white" strokeWidth="1"/>
      <circle cx="32" cy="52" r="1" fill="white"/>
      <circle cx="68" cy="32" r="1" fill="white"/>
    </svg>
  ),

  // Welding Mask
  () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3"/>
      <path d="M35 35 Q50 25 65 35 L70 55 Q50 65 30 55 Z" fill="currentColor"/>
      <rect x="40" y="40" width="20" height="12" fill="white" rx="2"/>
      <rect x="42" y="42" width="16" height="8" fill="currentColor"/>
      <line x1="50" y1="42" x2="50" y2="50" stroke="white" strokeWidth="1"/>
      <line x1="46" y1="46" x2="54" y2="46" stroke="white" strokeWidth="1"/>
      <path d="M45 60 Q50 62 55 60" stroke="white" strokeWidth="2" fill="none"/>
      <circle cx="45" cy="45" r="1" fill="white"/>
      <circle cx="55" cy="45" r="1" fill="white"/>
    </svg>
  )
];

export function ConstructionEmblem({ className = "w-8 h-8" }: ConstructionEmblemProps) {
  const [currentEmblem, setCurrentEmblem] = useState<number>(0);
  const [isGold, setIsGold] = useState<boolean>(false);
  const [showPrizeDialog, setShowPrizeDialog] = useState<boolean>(false);
  const { toast } = useToast();

  // Generate new emblem on component mount and site visits
  useEffect(() => {
    generateNewEmblem();
  }, []);

  const generateNewEmblem = () => {
    // 5% chance (1 in 20) for gold emblem
    const goldChance = Math.random() < 0.05;
    const emblemIndex = Math.floor(Math.random() * constructionEmblems.length);
    
    setCurrentEmblem(emblemIndex);
    setIsGold(goldChance);
    
    if (goldChance) {
      // Delay showing the prize dialog slightly for better UX
      setTimeout(() => {
        setShowPrizeDialog(true);
        toast({
          title: "🎉 GOLDEN EMBLEM!",
          description: "You've found a rare golden construction emblem! Claim your prize!",
          duration: 5000,
        });
      }, 1000);
    }
  };

  const EmblemComponent = constructionEmblems[currentEmblem];

  const handleClaimPrize = () => {
    // Here you would typically integrate with your prize/rewards system
    toast({
      title: "Prize Claimed!",
      description: "Your reward details will be sent to your email. Check your account for gift card information!",
      duration: 5000,
    });
    setShowPrizeDialog(false);
  };

  return (
    <>
      <div 
        className={`${className} cursor-pointer transition-all duration-300 hover:scale-110`}
        onClick={generateNewEmblem}
        title="Trade Scout Emblem - Click for a new one!"
      >
        <div 
          className={`${
            isGold 
              ? "text-yellow-500 filter drop-shadow-lg animate-pulse" 
              : "text-orange-500"
          } transition-all duration-500`}
        >
          <EmblemComponent />
        </div>
      </div>

      {/* Prize Dialog for Gold Emblem */}
      <Dialog open={showPrizeDialog} onOpenChange={setShowPrizeDialog}>
        <DialogContent className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-300 text-gray-900 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-bold text-yellow-800">
              <Trophy className="h-8 w-8 text-yellow-600" />
              Golden Emblem Found!
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="w-24 h-24 text-yellow-500 animate-spin-slow">
                <EmblemComponent />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-600" />
                <span className="font-semibold text-lg">Congratulations!</span>
                <Sparkles className="h-5 w-5 text-yellow-600" />
              </div>
              <p className="text-gray-700">
                You've discovered a rare golden construction emblem! 
                This happens only 1 in 20 times.
              </p>
            </div>

            <Card className="bg-white/50 border-yellow-300">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="h-5 w-5 text-yellow-600" />
                  <span className="font-semibold text-yellow-800">Your Prize:</span>
                </div>
                <p className="text-sm text-gray-700">
                  🎁 $25 Home Depot Gift Card<br/>
                  🔨 Or 15% off your next contractor hire<br/>
                  ⭐ Premium Trade Scout features for 30 days
                </p>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowPrizeDialog(false)}
                className="flex-1 border-yellow-300 text-yellow-800 hover:bg-yellow-50"
              >
                Maybe Later
              </Button>
              <Button
                onClick={handleClaimPrize}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                Claim Prize!
              </Button>
            </div>

            <p className="text-xs text-gray-600">
              Prize details will be sent to your registered email address.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}