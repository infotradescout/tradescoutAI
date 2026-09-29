import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const servicesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../services");
const roots = ["siteMigrationManifest.ts", "siteMigrationParity.ts"];

describe("migration assessment dependency boundary", () => {
  it("has a transitively pure import graph with no network, DNS, database, or provider entrypoint", () => {
    const visited = new Set<string>();
    const visit = (filename: string) => {
      const absolute = path.resolve(servicesDir, filename);
      expect(absolute.startsWith(`${servicesDir}${path.sep}`)).toBe(true);
      if (visited.has(absolute)) return;
      visited.add(absolute);
      const source = readFileSync(absolute, "utf8");
      expect(source).not.toMatch(/\b(?:tier|membership|payment|price)\b/i);
      expect(source).not.toMatch(/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/);
      expect(source).not.toMatch(/\b(?:require\s*\(|process\.env\b)/);
      expect(source).not.toMatch(/\bimport\s*\(/);
      const imports = [
        ...source.matchAll(/\b(?:import|export)\s+(?:[^;]*?\s+from\s+)?["']([^"']+)["']/g),
      ].map((match) => match[1]);
      for (const specifier of imports) {
        if (specifier === "node:crypto") continue;
        expect(specifier.startsWith("./")).toBe(true);
        expect(specifier).not.toMatch(/(?:db|route|fetch|provider|storage|dns|fs)/i);
        visit(`${specifier.slice(2)}.ts`);
      }
    };
    roots.forEach(visit);
    expect(visited.size).toBe(2);
  });
});
