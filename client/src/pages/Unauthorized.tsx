import React from "react";
import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function UnauthorizedPage() {
  return (
    <div className="flex items-center justify-center px-4 py-24">
      <Card className="w-full max-w-md bg-navy-900 border-navy-700 text-white">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <AlertCircle className="w-6 h-6 text-orange-400" />
          <CardTitle className="text-2xl font-bold">Unauthorized</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-300">
            You found a control room that's reserved for TradeScout admins.
          </p>
          <p className="text-gray-400 text-sm">
            If you believe you should have access here, contact the TradeScout team so they can
            review your account and permissions.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <a
              href="/"
              className="flex-1 inline-flex items-center justify-center rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-orange-600 transition-colors"
            >
              Back to Home
            </a>
            <a
              href="/scout?intent=access-review&source=unauthorized"
              className="flex-1 inline-flex items-center justify-center rounded-md border border-navy-600 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-navy-800 transition-colors"
            >
              Request Access Review
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
