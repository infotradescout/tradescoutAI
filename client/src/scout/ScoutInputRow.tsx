import React from "react";
import { ArrowRight, Mic, Send, Sparkles } from "lucide-react";

/* ----------------------------------------------------------
   ScoutInputRow — Morphic OS v2 Command Bar
   @reusable: scout-command-bar
   This is Scout's single command-bar owner. ScoutSearchDock places it in the
   first-use workspace or pins it above the taskbar after work begins.

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
  forcedPrefill?: string;
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
const SCOUT_INPUT_ACCESSIBLE_PROMPT = "Describe a project, permit question, estimate, or decision.";

type VoiceResultEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type VoiceRecognition = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: VoiceResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function voiceRecognitionConstructor(): (new () => VoiceRecognition) | null {
  if (typeof window === "undefined") return null;
  const browser = window as unknown as {
    SpeechRecognition?: new () => VoiceRecognition;
    webkitSpeechRecognition?: new () => VoiceRecognition;
  };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition ?? null;
}

export function ScoutInputRow({
  isBusy,
  prefillKey,
  forcedPrefill,
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
  const [voiceAvailable, setVoiceAvailable] = React.useState(false);
  const [isListening, setIsListening] = React.useState(false);
  const [voiceError, setVoiceError] = React.useState("");

  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const demoIndexRef = React.useRef(0);
  const demoTimeoutRef = React.useRef<number | null>(null);
  const demoIntervalRef = React.useRef<number | null>(null);
  const sendTimeoutRef = React.useRef<number | null>(null);
  const voiceRef = React.useRef<VoiceRecognition | null>(null);

  React.useEffect(() => {
    setVoiceAvailable(Boolean(voiceRecognitionConstructor()));
    return () => voiceRef.current?.stop();
  }, []);

  const handleVoiceClick = () => {
    if (voiceRef.current) {
      voiceRef.current.stop();
      return;
    }
    const Recognition = voiceRecognitionConstructor();
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.lang = document.documentElement.lang || navigator.language || "en-US";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join(" ")
        .trim();
      if (!transcript) return;
      onTyping();
      setValue((current) => `${current.trim()} ${transcript}`.trim());
      setVoiceError("");
    };
    recognition.onerror = () => {
      setVoiceError("Voice input was unavailable. Type your request instead.");
    };
    recognition.onend = () => {
      voiceRef.current = null;
      setIsListening(false);
    };
    try {
      recognition.start();
      voiceRef.current = recognition;
      setIsListening(true);
      setVoiceError("");
    } catch {
      setVoiceError("Voice input was unavailable. Type your request instead.");
    }
  };

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
  };

  React.useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (!value) {
      textarea.style.removeProperty("height");
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  // Load draft
  React.useEffect(() => {
    if (forcedPrefill) {
      setValue(forcedPrefill);
      return;
    }
    try {
      const stored = window.localStorage.getItem(`scout:prefill:scout-main`);
      if (stored && !value) setValue(stored);
    } catch {
      /* ignore */
    }
  }, [forcedPrefill, prefillKey]);

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
  const promptList = Array.isArray(quickStartPrompts) ? quickStartPrompts : [];

  return (
    <div className="scout-input-row space-y-2">
      {/* Command bar — @reusable: scout-command-bar (see index.css) */}
      <div
        className="scout-command-bar"
        style={
          isFocused
            ? {
                borderColor: "var(--theme-accent-primary)",
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
          placeholder="Describe the job or decision..."
          rows={1}
          className="scout-command-bar__input"
          aria-label={SCOUT_INPUT_ACCESSIBLE_PROMPT}
        />

        {/* Mic button */}
        {voiceAvailable ? (
          <button
            type="button"
            className="scout-command-bar__mic"
            aria-label={isListening ? "Stop voice input" : "Voice input"}
            aria-pressed={isListening}
            onClick={handleVoiceClick}
          >
            <Mic size={15} />
          </button>
        ) : null}

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
      {voiceError ? (
        <p role="status" className="text-xs text-[var(--text-secondary)]">
          {voiceError}
        </p>
      ) : null}
      {/* Real starting actions, kept visible at phone widths. */}
      {promptList.length > 0 && (
        <div className="scout-quickstarts" aria-label={SCOUT_INPUT_ACTION_HINT}>
          <p className="scout-quickstarts__label">Or start with</p>
          <div className="scout-quickstarts__grid">
            {promptList.map((prompt, index) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onSend(prompt)}
                disabled={isBusy}
                className="scout-quickstarts__item"
              >
                <span className="scout-quickstarts__number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{prompt}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
