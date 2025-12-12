import React, { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";

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

const AUTO_DEMO_STORAGE_KEY = "scout:autoDemo:v1";
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

  const demoIndexRef = useRef(0);
  const demoTimeoutRef = useRef<number | null>(null);
  const demoIntervalRef = useRef<number | null>(null);
  const sendTimeoutRef = useRef<number | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  }, [value, prefillKey]);

  const clearDemoTimers = () => {
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualChange: React.ChangeEventHandler<HTMLTextAreaElement> = (e) => {
    if (!value && e.target.value.trim().length > 0) {
      onUserTyping?.();
    }
    // If the user starts typing while the demo is running, cancel the demo
    if (isTypingDemo) {
      setIsTypingDemo(false);
      clearDemoTimers();
      try {
        window.sessionStorage.setItem(AUTO_DEMO_STORAGE_KEY, "1");
      } catch {
        // ignore storage errors
      }
    }
    setValue(e.target.value);
  };

  // Auto-typing demo for guests
  useEffect(() => {
    if (!enableAutoDemo || !autoDemoText) return;
    if (typeof window === "undefined") return;

    // Only run once per browser session and only if user hasn't started typing
    try {
      if (window.sessionStorage.getItem(AUTO_DEMO_STORAGE_KEY)) return;
    } catch {
      // ignore storage errors
    }
    if (value.trim().length > 0) return;

    setIsTypingDemo(true);
    try {
      window.sessionStorage.setItem(AUTO_DEMO_STORAGE_KEY, "1");
    } catch {
      // ignore storage errors
    }

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
            handleSubmit(autoDemoText);
          }, AUTO_DEMO_SEND_DELAY_MS);
        }
      }, AUTO_DEMO_TYPE_DELAY_MS);
    }, AUTO_DEMO_START_DELAY_MS) as unknown as number;

    return () => {
      clearDemoTimers();
    };
    // we intentionally do *not* include `value` here to avoid restarting demo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableAutoDemo, autoDemoText]);

  const isButtonDisabled =
    disabled || isSubmitting || (!value.trim() && !isTypingDemo);

  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={value}
        onChange={handleManualChange}
        disabled={disabled}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-none rounded-2xl border border-slate-800 bg-[#020617] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-400/70 focus:outline-none focus:ring-2 focus:ring-orange-500/60 min-h-[80px]"
      />
      <button
        type="button"
        onClick={() => handleSubmit()}
        disabled={isButtonDisabled}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-700 px-4 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Send className="h-4 w-4" />
        <span>{isSubmitting ? "Sending..." : "Send"}</span>
      </button>
    </div>
  );
};

export default ScoutInput;
