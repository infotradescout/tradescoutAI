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
        className="w-full bg-slate-900/60 rounded-xl p-4 outline-none text-sm text-slate-100 resize-none"
        placeholder="Ask anything  local intel, pros, marketplace, or meal deals."
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 font-semibold disabled:bg-slate-700 disabled:cursor-not-allowed"
      >
        Send
      </button>
    </form>
  );
}
