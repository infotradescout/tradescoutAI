import React, { FormEvent } from "react";

interface ScoutInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
}

export function ScoutInput({ value, onChange, onSend, disabled }: ScoutInputProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!disabled && value.trim()) {
      onSend();
    }
  };

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <textarea
        className="w-full bg-gray-900/40 rounded-xl p-4 outline-none text-sm text-gray-200"
        placeholder="Ask anything — local intel, pros, marketplace, etc."
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      <button
        type="submit"
        disabled={!value.trim() || disabled}
        className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
      >
        Send
      </button>
    </form>
  );
}
