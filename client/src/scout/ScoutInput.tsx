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

  // Auto-focus the main Scout input so it feels like the
  // primary action, matching the ChatGPT-style mental model.
  useEffect(() => {
    if (disabled) return;
    if (!textareaRef.current) return;
    try {
      textareaRef.current.focus();
    } catch {
      // ignore focus errors (e.g., mobile safari restrictions)
    }
  }, [disabled]);

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
        window.sessionStorage.setItem(AUTO_DEMO_STORAGE_KEY, "1");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Auto-typing demo for guests
  useEffect(() => {
    if (!enableAutoDemo || !autoDemoText) return;
    if (typeof window === "undefined") return;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableAutoDemo, autoDemoText]);

  const isButtonDisabled =
    disabled || isSubmitting || (!value.trim() && !isTypingDemo);

  return (
    <div className="mt-3 space-y-2">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleManualChange}
        disabled={disabled}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-none rounded-2xl border border-slate-600 bg-slate-950/90 px-4 py-3.5 text-[13px] text-slate-100 placeholder:text-slate-400/80 focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-400 shadow-sm shadow-slate-900/60 min-h-[96px]"
      />
      <div
        className={`flex w-full ${
          handedness === "left" ? "justify-start" : "justify-end"
        }`}
      >
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={isButtonDisabled}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-orange-500/40 hover:from-orange-400 hover:to-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send className="h-4 w-4 text-white" />
          <span>{isSubmitting ? "Sending..." : "Send"}</span>
        </button>
      </div>
    </div>
  );
};

export default ScoutInput;
