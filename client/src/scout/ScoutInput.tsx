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

  const handleSubmit = (text?: string) => {
    const trimmed = (text ?? value).trim();
    if (!trimmed || disabled || isSubmitting) return;

    setIsSubmitting(true);
    try {
      onSend(trimmed);
      setValue("");
      if (prefillKey) {
        try {
          window.localStorage.removeItem(`scout:prefill:${prefillKey}`);
        } catch {
          // ignore storage errors
        }
      }
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
            handleSubmit(autoDemoText);
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
    <div className="space-y-1.5 scout-input">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleManualChange}
        disabled={disabled}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-none rounded-lg px-4 py-3 text-[15px] min-h-[96px] transition-all"
        style={{
          backgroundColor: "var(--bg-secondary)",
          color: "var(--text-primary)",
          border: "none",
          outline: "none",
        }}
      />
      <div
        className={`flex w-full ${handedness === "left" ? "justify-start" : "justify-end"} mt-1`}
      >
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={isButtonDisabled}
          className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            backgroundColor: "var(--theme-accent-primary)",
            color: "white",
            boxShadow: isButtonDisabled
              ? "none"
              : "0 4px 12px color-mix(in oklab, var(--theme-accent-primary) 35%, transparent)",
          }}
        >
          <Send className="h-4 w-4" />
          <span>{isSubmitting ? "Sending..." : "Send"}</span>
        </button>
      </div>
    </div>
  );
};

export default ScoutInput;
