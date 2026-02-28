import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface HelpArticleWrapperProps {
  children: ReactNode;
}

export function HelpArticleWrapper({ children }: HelpArticleWrapperProps) {
  return (
    <div className="space-y-6">
      <Card className="bg-tsCard/70 border-white/10">
        <CardContent className="p-4 md:p-5 space-y-2 text-sm md:text-base">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <AlertCircle className="w-4 h-4 text-ts-orange" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ts-orange mb-1">
                How this fits into TradeScout
              </p>
              <p className="text-white">
                This feature exists to support <span className="font-semibold">Connection Without Compromise</span>.
              </p>
              <p className="text-white/70 mt-1">
                TradeScout follows one rule: <span className="font-semibold">Discovery is limited. Engagement is exclusive.</span>
              </p>
              <p className="text-white/70 mt-2 text-xs md:text-sm">
                For the full system explanation, see
                <button
                  type="button"
                  className="ml-1 text-ts-orange underline underline-offset-2 hover:text-ts-orange"
                  onClick={() => {
                    window.location.assign(
                      "/help/how-tradescout-works#connection-without-compromise"
                    );
                  }}
                >
                  How TradeScout Works
                </button>
                .
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>{children}</div>
    </div>
  );
}
