/* eslint-disable no-restricted-syntax -- Live color swatches require the selected catalog hex. */
import { useEffect, useState } from "react";
import { Check, CheckCircle2 } from "lucide-react";

export const PROJECT_FIELD_CLASS =
  "min-h-12 w-full rounded-xl border border-[#18312f]/20 bg-white px-4 text-sm text-[#18312f] outline-none transition placeholder:text-[#7b8581] focus:border-[#a94f2e] focus:ring-2 focus:ring-[#a94f2e]/20";
export const PROJECT_TEXTAREA_CLASS = `${PROJECT_FIELD_CLASS} min-h-28 resize-y py-3 leading-6`;

function needsDarkCheck(hex: string): boolean {
  const normalized = hex.replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return false;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return red * 0.299 + green * 0.587 + blue * 0.114 > 155;
}

export function ProjectSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  testId,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  testId?: string;
}) {
  return (
    <label className="space-y-2 text-sm font-bold text-[#18312f]">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className={PROJECT_FIELD_CLASS}
        data-testid={testId}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ProjectTextSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  testId,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  testId?: string;
}) {
  return (
    <ProjectSelect
      label={label}
      value={value}
      options={options.map((option) => ({ value: option, label: option }))}
      onChange={onChange}
      testId={testId}
    />
  );
}

export function ProjectNumberField({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
  testId,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
  testId?: string;
}) {
  const [inputValue, setInputValue] = useState(String(value));

  useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  const commitValue = () => {
    const parsed = Number(inputValue);
    if (inputValue.trim() === "" || !Number.isFinite(parsed)) {
      setInputValue(String(value));
      return;
    }
    const nextValue = Math.min(max, Math.max(min, Math.round(parsed)));
    setInputValue(String(nextValue));
    if (nextValue !== value) onChange(nextValue);
  };

  return (
    <label className="space-y-2 text-sm font-bold text-[#18312f]">
      <span>{label}</span>
      <span className="relative block">
        <input
          type="number"
          inputMode="numeric"
          value={inputValue}
          min={min}
          max={max}
          step="1"
          onChange={(event) => {
            const nextInput = event.target.value;
            setInputValue(nextInput);
            const parsed = Number(nextInput);
            if (
              nextInput.trim() !== "" &&
              Number.isFinite(parsed) &&
              parsed >= min &&
              parsed <= max
            ) {
              const nextValue = Math.round(parsed);
              if (nextValue !== value) onChange(nextValue);
            }
          }}
          onBlur={commitValue}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className={`${PROJECT_FIELD_CLASS} pr-14`}
          data-testid={testId}
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#72807b]">
          {suffix}
        </span>
      </span>
    </label>
  );
}

export function ProjectColorField<T extends string>({
  label,
  value,
  options,
  onChange,
  testIdPrefix,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; hex: string }[];
  onChange: (value: T) => void;
  testIdPrefix?: string;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-bold text-[#18312f]">{label}</legend>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              aria-label={`${label}: ${option.label}`}
              title={option.label}
              onClick={() => onChange(option.value)}
              data-testid={testIdPrefix ? `${testIdPrefix}-${option.value}` : undefined}
              className={`grid h-11 w-11 place-items-center rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e] focus-visible:ring-offset-2 ${
                selected ? "border-[#18312f]" : "border-white shadow-[0_0_0_1px_rgba(24,49,47,.2)]"
              }`}
              style={{ backgroundColor: option.hex }}
            >
              {selected ? (
                <Check
                  className={`h-4 w-4 ${
                    needsDarkCheck(option.hex) ? "text-[#18312f]" : "text-white"
                  }`}
                  aria-hidden="true"
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function IncludeDesignButton({
  included,
  onClick,
  label,
  testId,
}: {
  included: boolean;
  onClick: () => void;
  label: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={included}
      onClick={onClick}
      data-testid={testId}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
        included
          ? "bg-[#18312f] text-white focus-visible:ring-[#18312f]"
          : "bg-[#c9683d] text-white shadow-[0_16px_45px_rgba(84,35,18,0.2)] hover:bg-[#b55732] focus-visible:ring-[#c9683d]"
      }`}
    >
      {included ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : null}
      {included ? "Added to my plan" : label}
    </button>
  );
}

export function ProjectToggle({
  checked,
  onChange,
  label,
  description,
  testId,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  testId?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-[#18312f]/10 bg-white/70 p-4">
      <span>
        <span className="block text-sm font-bold text-[#18312f]">{label}</span>
        {description ? (
          <span className="mt-1 block text-xs leading-5 text-[#6c7773]">{description}</span>
        ) : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 rounded border-[#18312f]/30 text-[#a94f2e] focus:ring-[#a94f2e]"
        data-testid={testId}
      />
    </label>
  );
}
