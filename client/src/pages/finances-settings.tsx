import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Page } from "@/components/layout/PagePrimitives";

export default function FinancesSettingsPage() {
  return (
    <Page className="space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-50 mb-1">Finances settings</h1>
        <p className="text-sm text-slate-400">
          Defaults, exports, and preferences that control how your money workspace behaves.
        </p>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-100">Defaults & preferences</CardTitle>
          <CardDescription className="text-xs text-slate-400">
            As the accounting engine matures, this workspace will centralize currency, tax, document, and export
            settings for your business.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-[11px] text-slate-400">
            For now, you can control most profile and business settings from the main Settings and Profile
            Settings pages. Finances-specific options will appear here as they come online.
          </p>
        </CardContent>
      </Card>
    </Page>
  );
}
