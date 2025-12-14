import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { Download, ShieldAlert, Trash2 } from "lucide-react";

export default function PrivacyRequest() {
  const { isAuthenticated, isLoading } = useAuth();
  const [reason, setReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const downloadHref = useMemo(() => "/api/user/data-export", []);

  const submitDeletionRequest = async () => {
    setResult(null);
    setIsSubmittingDelete(true);

    try {
      const res = await fetch("/api/user/account-deletion-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || "Failed to submit deletion request");
      }

      setResult({
        type: "success",
        message: body?.message || "Request submitted successfully.",
      });
      setConfirmDelete(false);
    } catch (e: any) {
      setResult({ type: "error", message: e?.message || "Something went wrong" });
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center px-4">
        <Card className="bg-navy-700 border-navy-600 w-full max-w-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-white text-xl">Privacy Requests</CardTitle>
            <CardDescription className="text-gray-300">
              Sign in to download your data or request account deletion.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Link href="/login">
              <Button className="btn-primary">Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <Card className="bg-navy-800 border-navy-700">
          <CardHeader>
            <CardTitle className="text-white text-2xl">Privacy Request Form</CardTitle>
            <CardDescription className="text-gray-300">
              Download a copy of your personal data, or request deletion of your account and data.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-8">
            {/* Download */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-orange-400" />
                <h2 className="text-white font-semibold">Download my data</h2>
              </div>
              <p className="text-sm text-gray-300">
                This downloads a ZIP containing your profile, messages, conversations, leads, and privacy settings.
              </p>
              <Button asChild className="btn-primary">
                <a href={downloadHref}>
                  <Download className="h-4 w-4 mr-2" />
                  Download My Data (ZIP)
                </a>
              </Button>
              <p className="text-xs text-gray-400">
                Your download may take a few seconds to generate.
              </p>
            </section>

            <Separator className="bg-navy-700" />

            {/* Delete */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-red-400" />
                <h2 className="text-white font-semibold">Request account deletion</h2>
              </div>

              <p className="text-sm text-gray-300">
                This submits a deletion request for review. Once approved, we will delete your account and associated data.
              </p>

              <div className="space-y-2">
                <label className="text-sm text-gray-200">Reason (optional)</label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Tell us why you're requesting deletion (optional)"
                  className="bg-navy-900 border-navy-700 text-gray-100 placeholder:text-gray-500"
                />
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  checked={confirmDelete}
                  onCheckedChange={(v) => setConfirmDelete(v === true)}
                  className="border-navy-600"
                />
                <div className="text-sm text-gray-300">
                  I understand this will start the account deletion process and may not be reversible once approved.
                </div>
              </div>

              <Button
                variant="destructive"
                disabled={!confirmDelete || isSubmittingDelete}
                onClick={submitDeletionRequest}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isSubmittingDelete ? "Submitting…" : "Request Account Deletion"}
              </Button>

              {result ? (
                <div
                  className={`text-sm rounded-md px-3 py-2 border ${
                    result.type === "success"
                      ? "border-green-700/60 bg-green-900/20 text-green-200"
                      : "border-red-700/60 bg-red-900/20 text-red-200"
                  }`}
                >
                  {result.message}
                </div>
              ) : null}
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
