import { useI18n, type AppLanguage } from "@/lib/i18n";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { language, setLanguage, t } = useI18n();

  const options: Array<{ value: AppLanguage; label: string }> = [
    { value: "en", label: t("common.english") },
    { value: "es", label: t("common.spanish") },
  ];

  return (
    <label className={`inline-flex items-center gap-2 text-xs text-white/70 ${className}`}>
      <span>{t("common.language")}</span>
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as AppLanguage)}
        className="rounded border border-white/20 bg-black/40 px-2 py-1 text-xs text-white"
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
