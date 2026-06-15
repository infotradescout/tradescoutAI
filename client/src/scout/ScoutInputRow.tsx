import React from "react";
import { Mic, Send, Sparkles } from "lucide-react";

/* ----------------------------------------------------------
   ScoutInputRow — Morphic OS v2 Command Bar
   @reusable: scout-command-bar
   This is the persistent input surface at the bottom of the Scout OS.
   It can be dropped into any surface that needs a Scout command bar.

   Visual spec (matches screenshots):
   - Orange border glow on focus/active
   - Sparkle icon on the left (orange)
   - Auto-growing textarea (single line default, expands on input)
   - Mic button (right, subtle circle)
   - Orange circle send arrow (right, glowing)
   ---------------------------------------------------------- */

interface ScoutInputRowProps {
  isBusy: boolean;
  prefillKey: number;
  onSend: (value: string) => void;
  onTyping: () => void;
  quickStartPrompts?: readonly string[];
  autoDemoText?: string;
  enableAutoDemo?: boolean;
}

const INTRO_DEMO_SESSION_KEY = "ts_intro_demo_session";
const AUTO_DEMO_START_DELAY_MS = 600;
const AUTO_DEMO_TYPE_DELAY_MS = 45;
const AUTO_DEMO_SEND_DELAY_MS = 400;
const SCOUT_INPUT_ACTION_HINT = "Search • Compare • Choose";
const SCOUT_INPUT_ACCESSIBLE_PROMPT =
  "Search local help, compare options, or review your next step.";

export function ScoutInputRow({
  isBusy,
  prefillKey,
  onSend,
  onTyping,
  quickStartPrompts,
  autoDemoText,
  enableAutoDemo,
}: ScoutInputRowProps) {
  const [value, setValue] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isTypingDemo, setIsTypingDemo] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);

  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const demoIndexRef = React.useRef(0);
  const demoTimeoutRef = React.useRef<number | null>(null);
  const demoIntervalRef = React.useRef<number | null>(null);
  const sendTimeoutRef = React.useRef<number | null>(null);

  const clearDemoTimers = () => {
    if (typeof window === "undefined") return;
    if (demoTimeoutRef.current !== null) {
      window.clearTimeout(demoTimeoutRef.current);
      demoTimeoutRef.current = null;
    }
    if (demoIntervalRef.current !== null) {
      window.clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
    if (sendTimeoutRef.current !== null) {
      window.clearTimeout(sendTimeoutRef.current);
      sendTimeoutRef.current = null;
    }
  };

  const handleSubmit = async (text?: string) => {
    const trimmed = (text ?? value).trim();
    if (!trimmed || isBusy || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await Promise.resolve(onSend(trimmed));
      setValue("");
      try {
        window.localStorage.removeItem(`scout:prefill:scout-main`);
      } catch {
        /* ignore */
      }
    } catch (err) {
      console.error("[ScoutInputRow] send failed", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualChange: React.ChangeEventHandler<HTMLTextAreaElement> = (e) => {
    if (!value && e.target.value.trim().length > 0) onTyping();
    if (isTypingDemo) {
      setIsTypingDemo(false);
      clearDemoTimers();
      try {
        window.sessionStorage.setItem(INTRO_DEMO_SESSION_KEY, "1");
      } catch {
        /* ignore */
      }
    }
    setValue(e.target.value);
    // Auto-grow textarea
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  // Load draft
  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(`scout:prefill:scout-main`);
      if (stored && !value) setValue(stored);
    } catch {
      /* ignore */
    }
  }, [prefillKey]);

  // Persist draft
  React.useEffect(() => {
    try {
      if (value) window.localStorage.setItem(`scout:prefill:scout-main`, value);
      else window.localStorage.removeItem(`scout:prefill:scout-main`);
    } catch {
      /* ignore */
    }
  }, [value]);

  // Auto-demo
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!enableAutoDemo || !autoDemoText) return;
    try {
      if (window.sessionStorage.getItem(INTRO_DEMO_SESSION_KEY)) return;
    } catch {
      /* ignore */
    }
    if (value.trim().length > 0) return;
    try {
      window.localStorage.removeItem(`scout:prefill:scout-main`);
    } catch {
      /* ignore */
    }
    setIsTypingDemo(true);
    demoIndexRef.current = 0;
    demoTimeoutRef.current = window.setTimeout(() => {
      demoIntervalRef.current = window.setInterval(() => {
        demoIndexRef.current += 1;
        const next = autoDemoText.slice(0, demoIndexRef.current);
        setValue(next);
        if (demoIndexRef.current >= autoDemoText.length) {
          clearDemoTimers();
          setIsTypingDemo(false);
          sendTimeoutRef.current = window.setTimeout(() => {
            try {
              window.sessionStorage.setItem(INTRO_DEMO_SESSION_KEY, "1");
            } catch {
              /* ignore */
            }
            void handleSubmit(autoDemoText);
          }, AUTO_DEMO_SEND_DELAY_MS);
        }
      }, AUTO_DEMO_TYPE_DELAY_MS);
    }, AUTO_DEMO_START_DELAY_MS) as unknown as number;
    return () => clearDemoTimers();
  }, [enableAutoDemo, autoDemoText, prefillKey]);

  const isButtonDisabled = isBusy || isSubmitting || (!value.trim() && !isTypingDemo);
  const promptList = Array.isArray(quickStartPrompts) ? quickStartPrompts.slice(0, 2) : [];

  return (
    <div className="space-y-2">
      {/* Quick-start prompts — shown only when no messages yet */}
      {promptList.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1" aria-label={SCOUT_INPUT_ACTION_HINT}>
          {promptList.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onSend(prompt)}
              disabled={isBusy}
              className="rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50"
              style={{
                background: "var(--surface-intermediate)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(250,250,250,0.6)",
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Command bar — @reusable: scout-command-bar (see index.css) */}
      <div
        className="scout-command-bar"
        style={
          isFocused
            ? {
                borderColor: "#f97316",
                boxShadow: "0 0 0 3px rgba(249,115,22,0.12), 0 0 20px rgba(249,115,22,0.08)",
              }
            : {}
        }
      >
        {/* Sparkle icon */}
        <Sparkles
          size={18}
          className="scout-command-bar__sparkle flex-shrink-0"
          aria-hidden="true"
        />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleManualChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={isBusy}
          placeholder="Search local help, compare options, or review your next step."
          rows={1}
          className="scout-command-bar__input"
          aria-label={SCOUT_INPUT_ACCESSIBLE_PROMPT}
        />

        {/* Mic button */}
        <button
          type="button"
          className="scout-command-bar__mic"
          aria-label="Voice input"
          tabIndex={-1}
        >
          <Mic size={15} />
        </button>

        {/* Send button */}
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={isButtonDisabled}
          className="scout-command-bar__send"
          aria-label={isSubmitting ? "Searching..." : "Start search"}
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
