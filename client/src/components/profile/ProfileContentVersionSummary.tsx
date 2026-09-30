type Props = {
  heading: string;
  displayName: string;
  headline: string | null;
  contentBlocks: unknown;
};

function sectionLabel(type: string): string {
  if (type.toLowerCase() === "about") return "About";
  return type
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (first) => first.toUpperCase());
}

function sectionLines(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const data = value as Record<string, unknown>;
  const lines = [data.title, data.heading, data.body, data.text, data.description]
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .map((entry) => entry.trim());
  return [...new Set(lines)];
}

export default function ProfileContentVersionSummary({
  heading,
  displayName,
  headline,
  contentBlocks,
}: Props) {
  const sections = Array.isArray(contentBlocks) ? contentBlocks : [];
  return (
    <div className="space-y-2 rounded-md border border-white/20 p-3">
      <h4 className="font-semibold">{heading}</h4>
      <p>Name: {displayName || "No name"}</p>
      <p>Headline: {headline || "No headline"}</p>
      <p>{sections.length} page sections</p>
      <ul className="max-h-56 space-y-2 overflow-auto">
        {sections.map((entry: unknown, index: number) => {
          const block = entry && typeof entry === "object" && !Array.isArray(entry)
            ? (entry as Record<string, unknown>)
            : null;
          const label = sectionLabel(typeof block?.type === "string" ? block.type : "Other section");
          const lines = sectionLines(block?.data);
          return (
            <li key={index} className="rounded border border-white/10 p-2">
              <strong>{label}</strong>
              {lines.map((line, lineIndex) => (
                <p key={lineIndex} className="whitespace-pre-wrap break-words text-white/75">
                  {line}
                </p>
              ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
