import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Page } from "@/components/layout/PagePrimitives";

export default function FinancesSettingsPage() {
  return (
    <Page className="space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-white mb-1">Finances settings</h1>
        <p className="text-sm text-white/60">
          Defaults, exports, and preferences that control how your finances work.
        </p>
      </div>

      <Card className="bg-tsCard border-white/10">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-white">Defaults & preferences</CardTitle>
          <CardDescription className="text-xs text-white/60">
            As the accounting engine matures, this page will centralize currency, tax, document, and
            export settings for your business.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-[11px] text-white/60">
            For now, you can control most profile and business settings from the main Settings and
            Profile Settings pages. Finances-specific options will appear here as they come online.
          </p>
        </CardContent>
      </Card>
    </Page>
  );
}
