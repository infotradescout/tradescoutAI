import { useEffect, useState } from "react";

interface PromptStatus {
  cached: boolean;
  lastLoaded: string | null;
  reloadIntervalMs: number;
  promptPath: string;
  exists: boolean;
}

export function PromptAdminPage() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<PromptStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load system prompt on mount
  useEffect(() => {
    loadPrompt();
  }, []);

  async function loadPrompt() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/prompt-admin");

      if (!res.ok) {
        if (res.status === 401) {
          setError("Authentication required. Please log in.");
        } else if (res.status === 403) {
          setError("Access denied. Super admin access required.");
        } else {
          setError(`Failed to load prompt: ${res.statusText}`);
        }
        setContent("");
        setLoading(false);
        return;
      }

      const data = await res.json();
      setContent(data.content || "");
      setStatus(data.status || null);
      setSuccess("System prompt loaded successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load system prompt");
      setContent("");
    } finally {
      setLoading(false);
    }
  }

  async function savePrompt() {
    if (!content.trim()) {
      setError("Prompt content cannot be empty");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/prompt-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        if (res.status === 403) {
          setError("Access denied. Super admin access required.");
        } else {
          const errData = await res.json();
          setError(errData.error || `Failed to save prompt: ${res.statusText}`);
        }
        return;
      }

      const data = await res.json();
      setSuccess(data.message || "System prompt saved and reloaded successfully!");
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save system prompt");
    } finally {
      setSaving(false);
    }
  }

  async function forceReload() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/prompt-admin/reload", { method: "POST" });

      if (!res.ok) {
        setError(`Failed to reload: ${res.statusText}`);
        return;
      }

      const data = await res.json();
      setSuccess(data.message || "Prompt reloaded from disk");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reload system prompt");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading system prompt…</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b pb-6">
        <h1 className="text-3xl font-bold mb-2">System Prompt Editor</h1>
        <p className="text-gray-600 max-w-2xl">
          Edit Scout's system prompt in real-time. Changes apply immediately to all new
          conversations. This controls how Scout behaves, interprets user requests, and resolves the
          knowledge hierarchy.
        </p>
      </div>

      {/* Status Section */}
      {status && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <div className="font-semibold text-blue-900">Prompt Status</div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Cached:</span>
              <span className="ml-2 font-mono">{status.cached ? "✓ Yes" : "✗ No"}</span>
            </div>
            <div>
              <span className="text-gray-600">Last Loaded:</span>
              <span className="ml-2 font-mono">
                {status.lastLoaded ? new Date(status.lastLoaded).toLocaleString() : "Never"}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Reload Interval:</span>
              <span className="ml-2 font-mono">{status.reloadIntervalMs / 1000}s</span>
            </div>
            <div>
              <span className="text-gray-600">File Exists:</span>
              <span className="ml-2 font-mono">{status.exists ? "✓ Yes" : "✗ No"}</span>
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-2 font-mono break-all">{status.promptPath}</div>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">{error}</div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
          {success}
        </div>
      )}

      {/* Editor */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">System Prompt Markdown</label>
        <textarea
          className="w-full h-[60vh] border-2 border-gray-300 rounded-lg p-4 font-mono text-sm focus:border-blue-500 focus:outline-none resize-none"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Enter system prompt in Markdown format…"
        />
      </div>

      {/* Character count */}
      <div className="text-sm text-gray-500">
        {content.length.toLocaleString()} characters
        {content.split("\n").length > 0 && ` • ${content.split("\n").length} lines`}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={savePrompt}
          disabled={saving || !content.trim()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving…" : "Save Prompt"}
        </button>

        <button
          onClick={forceReload}
          disabled={saving}
          className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Loading…" : "Reload from Disk"}
        </button>

        <button
          onClick={loadPrompt}
          disabled={saving || loading}
          className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          Discard Changes
        </button>
      </div>

      {/* Info Section */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700 space-y-2">
        <div className="font-semibold">How This Works</div>
        <ul className="list-disc list-inside space-y-1">
          <li>
            Your changes are saved to{" "}
            <code className="font-mono">server/cache/manual/system_prompt.md</code>
          </li>
          <li>The prompt is cached for 30 seconds for performance</li>
          <li>Click "Save" to write changes to disk and force reload</li>
          <li>New conversations immediately use the updated prompt</li>
          <li>Existing conversations keep their original context</li>
        </ul>
      </div>
    </div>
  );
}
