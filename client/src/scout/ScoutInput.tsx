import React, { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { useHandedness } from "@/hooks/useHandedness";

type ScoutInputProps = {
  disabled?: boolean;
  placeholder?: string;
  prefillKey?: string;
  initialValue?: string;
  onSend: (text: string) => void;
  onUserTyping?: () => void;
  autoDemoText?: string;
  enableAutoDemo?: boolean;
};

const INTRO_DEMO_SESSION_KEY = "ts_intro_demo_session";
const AUTO_DEMO_START_DELAY_MS = 600;
const AUTO_DEMO_TYPE_DELAY_MS = 45;
const AUTO_DEMO_SEND_DELAY_MS = 400;

const ScoutInput: React.FC<ScoutInputProps> = ({
  disabled,
  placeholder,
  prefillKey,
  initialValue,
  onSend,
  onUserTyping,
  autoDemoText,
  enableAutoDemo,
}) => {
  const [value, setValue] = useState<string>(initialValue ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTypingDemo, setIsTypingDemo] = useState(false);
  const handedness = useHandedness();

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const demoIndexRef = useRef(0);
  const demoTimeoutRef = useRef<number | null>(null);
  const demoIntervalRef = useRef<number | null>(null);
  const sendTimeoutRef = useRef<number | null>(null);

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
    if (!trimmed || disabled || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await Promise.resolve(onSend(trimmed));
      setValue("");
      if (prefillKey) {
        try {
          window.localStorage.removeItem(`scout:prefill:${prefillKey}`);
        } catch {
          // ignore storage errors
        }
      }
    } catch (err) {
      // handleSend should swallow and recover, but never let input throw.
      console.error("[ScoutInput] send failed", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualChange: React.ChangeEventHandler<HTMLTextAreaElement> = (e) => {
    if (!value && e.target.value.trim().length > 0) {
      onUserTyping?.();
    }

    if (isTypingDemo) {
      setIsTypingDemo(false);
      clearDemoTimers();
      try {
        window.sessionStorage.setItem(INTRO_DEMO_SESSION_KEY, "1");
      } catch {
        // ignore storage errors
      }
    }

    setValue(e.target.value);
  };

  // Load any stored draft if using prefillKey
  useEffect(() => {
    if (!prefillKey) return;
    try {
      const stored = window.localStorage.getItem(`scout:prefill:${prefillKey}`);
      if (stored && !value) {
        setValue(stored);
      }
    } catch {
      // ignore storage errors
    }
  }, [prefillKey]);

  // Persist drafts while typing
  useEffect(() => {
    if (!prefillKey) return;
    try {
      if (value) {
        window.localStorage.setItem(`scout:prefill:${prefillKey}`, value);
      } else {
        window.localStorage.removeItem(`scout:prefill:${prefillKey}`);
      }
    } catch {
      // ignore storage errors
    }
  }, [prefillKey, value]);

  // Auto-typing demo for guests ONLY
  // Behavior:
  // 1. Clear any stored draft BEFORE demo starts
  // 2. Demo runs only once per session (sessionStorage guard)
  // 3. Manual typing immediately stops demo
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (import.meta.env.DEV) {
      console.log("[INTRO DEMO INPUT CHECK]", {
        enableAutoDemo,
        autoDemoTextLen: autoDemoText ? autoDemoText.length : 0,
        sessionPlayed: window.sessionStorage.getItem(INTRO_DEMO_SESSION_KEY),
        currentValueLen: value ? value.length : 0,
      });
    }
    if (!enableAutoDemo || !autoDemoText) return;

    try {
      if (window.sessionStorage.getItem(INTRO_DEMO_SESSION_KEY)) {
        if (import.meta.env.DEV) console.log("[INTRO DEMO] Already played this session, skipping");
        return;
      }
    } catch {
      // ignore storage errors
    }

    if (value.trim().length > 0) return;

    if (import.meta.env.DEV)
      console.log("[INTRO DEMO] STARTING auto-demo; clearing any draft first");

    // CRITICAL: Clear draft before demo fires
    if (prefillKey) {
      try {
        window.localStorage.removeItem(`scout:prefill:${prefillKey}`);
      } catch {
        // ignore storage errors
      }
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
            if (import.meta.env.DEV)
              console.log("[INTRO DEMO] Sending auto-prompt and marking session as played");
            try {
              window.sessionStorage.setItem(INTRO_DEMO_SESSION_KEY, "1");
            } catch {
              // ignore storage errors
            }
            void handleSubmit(autoDemoText);
          }, AUTO_DEMO_SEND_DELAY_MS);
        }
      }, AUTO_DEMO_TYPE_DELAY_MS);
    }, AUTO_DEMO_START_DELAY_MS) as unknown as number;

    return () => {
      clearDemoTimers();
    };
  }, [enableAutoDemo, autoDemoText, prefillKey]);

  const isButtonDisabled = disabled || isSubmitting || (!value.trim() && !isTypingDemo);

  return (
    <div
      className="space-y-2.5 scout-input scout-input-refined rounded-xl p-2.5 md:p-3"
      style={{
        border: "1px solid var(--border-subtle)",
        background: "color-mix(in oklab, var(--surface-card) 90%, transparent)",
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleManualChange}
        disabled={disabled}
        placeholder={placeholder || "Ask Scout who, what, where, or what changed nearby."}
        rows={3}
        className="w-full min-h-[110px] resize-none rounded-xl px-3.5 py-3 text-[15px] leading-relaxed transition-colors focus:outline-none placeholder:text-[color:var(--text-secondary)]"
        style={{
          border: "1px solid var(--border-subtle)",
          background: "color-mix(in oklab, var(--surface-intermediate) 92%, transparent)",
          color: "var(--text-primary)",
        }}
      />
      <div
        className={`flex w-full ${handedness === "left" ? "justify-start" : "justify-end"} mt-1`}
      >
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={isButtonDisabled}
          className="scout-send-btn inline-flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed sm:w-auto sm:py-2"
          style={{
            borderColor: isButtonDisabled ? "var(--border-subtle)" : "var(--theme-accent-primary)",
            backgroundColor: isButtonDisabled
              ? "color-mix(in oklab, var(--surface-intermediate) 88%, transparent)"
              : "var(--theme-accent-primary)",
            color: isButtonDisabled ? "var(--text-secondary)" : "var(--ts-text-on-accent, #0B0F14)",
          }}
        >
          <Send className="h-4 w-4" />
          <span>{isSubmitting ? "Checking..." : "Ask Scout"}</span>
        </button>
      </div>
    </div>
  );
};

export default ScoutInput;
