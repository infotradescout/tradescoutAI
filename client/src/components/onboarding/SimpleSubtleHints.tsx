import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Lightbulb } from 'lucide-react';

export const SimpleSubtleHints = memo(function SimpleSubtleHints() {
  // Simple component without hooks to avoid context errors
  return (
    <div className="fixed bottom-20 left-6 z-40">
      <Card className="bg-slate-800/90 border-slate-600 shadow-xl max-w-sm">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Lightbulb className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-white mb-1">
                Welcome to TradeScout!
              </h4>
              <p className="text-xs text-slate-300 mb-3">
                Click the help button for guided tours and tips.
              </p>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
                Got it
              </Button>
            </div>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
              <X className="w-3 h-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

export default SimpleSubtleHints;