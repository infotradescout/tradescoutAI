import React, { useState } from "react";

interface ScoutInputProps {
  disabled?: boolean;
  initialValue?: string;
  onSend: (value: string) => void;
}

export default function ScoutInput({
  disabled,
  initialValue = "",
  onSend,
}: ScoutInputProps) {
  const [value, setValue] = useState(initialValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        className="w-full resize-none rounded-2xl border border-slate-800 bg-[#020617] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-400/70 focus:outline-none focus:ring-2 focus:ring-orange-500/60 focus:border-orange-500/60 min-h-[80px]"
        placeholder="Ask anything — local intel, pros, marketplace, or meal deals."
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="w-full py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 font-semibold disabled:bg-slate-700 disabled:cursor-not-allowed"
      >
        Send
      </button>
    </form>
  );
}
