import { useMemo } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, ExternalLink, CheckCircle2 } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useIsStandalone } from "@/hooks/useIsStandalone";

function detectInstallContext(userAgent: string) {
  const ua = userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);
  const isInApp =
    /fban|fbav|instagram|line\/|snapchat|tiktok|twitter/.test(ua) ||
    // Android WebView signals
    /\bwv\b/.test(ua);

  // "CriOS" is Chrome on iOS (still uses iOS A2HS flow via share sheet).
  const isIOSChrome = isIOS && /crios/.test(ua);

  return { isIOS, isAndroid, isInApp, isIOSChrome };
}

export default function InstallPage() {
  const { canPromptInstall, promptInstall } = useInstallPrompt();
  const isStandalone = useIsStandalone();

  const ctx = useMemo(() => detectInstallContext(navigator.userAgent || ""), []);

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          Install TradeScout
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Add TradeScout to your home screen so it feels like an app.
        </p>
      </div>

      {isStandalone ? (
        <Card style={{ background: "var(--surface-intermediate)", borderColor: "var(--border-primary)" }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />
              Already installed
            </CardTitle>
            <CardDescription>You’re running TradeScout as an installed app.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Link href="/scout">
              <Button>Go to Scout</Button>
            </Link>
          </CardContent>
        </Card>
      ) : canPromptInstall ? (
        <Card style={{ background: "var(--surface-intermediate)", borderColor: "var(--border-primary)" }}>
          <CardHeader>
            <CardTitle>Install in one tap</CardTitle>
            <CardDescription>Your browser supports app install for TradeScout.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Button
              onClick={() => promptInstall()}
              className="inline-flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Install
            </Button>
            <Link href="/landing">
              <Button variant="outline">Not now</Button>
            </Link>
          </CardContent>
        </Card>
      ) : ctx.isIOS ? (
        <Card style={{ background: "var(--surface-intermediate)", borderColor: "var(--border-primary)" }}>
          <CardHeader>
            <CardTitle>Install on iPhone / iPad</CardTitle>
            <CardDescription>
              iOS doesn’t show a built-in install prompt. Use “Add to Home Screen”.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ctx.isInApp && (
              <div className="rounded-md border p-3 text-sm" style={{ borderColor: "var(--border-primary)", color: "var(--text-secondary)" }}>
                You’re in an in-app browser. Tap the menu and choose{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Open in Safari</span>{" "}
                first, then follow the steps below.
              </div>
            )}
            <ol className="list-decimal pl-5 text-sm" style={{ color: "var(--text-secondary)" }}>
              <li>Tap the Share button in your browser.</li>
              <li>Select <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Add to Home Screen</span>.</li>
              <li>Open TradeScout from your home screen.</li>
            </ol>
            <div className="flex gap-2">
              <Link href="/landing">
                <Button variant="outline" className="inline-flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Go to Landing
                </Button>
              </Link>
              <Link href="/scout">
                <Button>Continue</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card style={{ background: "var(--surface-intermediate)", borderColor: "var(--border-primary)" }}>
          <CardHeader>
            <CardTitle>Install from your browser menu</CardTitle>
            <CardDescription>
              Look for “Install app” or “Add to Home screen” in your browser.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ctx.isInApp && (
              <div className="rounded-md border p-3 text-sm" style={{ borderColor: "var(--border-primary)", color: "var(--text-secondary)" }}>
                If install isn’t available here, open this link in Chrome or Safari first.
              </div>
            )}
            <ol className="list-decimal pl-5 text-sm" style={{ color: "var(--text-secondary)" }}>
              <li>Open your browser menu (⋮ or Share).</li>
              <li>Select <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Install app</span> (or <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Add to Home screen</span>).</li>
              <li>Confirm.</li>
            </ol>
            <div className="flex gap-2">
              <Link href="/landing">
                <Button variant="outline" className="inline-flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Go to Landing
                </Button>
              </Link>
              <Link href="/scout">
                <Button>Continue</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
