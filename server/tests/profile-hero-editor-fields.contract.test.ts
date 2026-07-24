import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  patchHeroBlock,
  readHeroEditorFields,
} from "@shared/profileSiteTemplates";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("profile hero editor field mapping", () => {
  it("reads and writes headerLabel/teaser used by ISSA Build and wholesaler heroes", () => {
    const manage = read("client/src/components/profile/ProfileSiteManageChrome.tsx");
    const editor = read("client/src/pages/ProfileSiteEditor.tsx");

    expect(manage).toContain("readHeroEditorFields");
    expect(editor).toContain("readHeroEditorFields");
    expect(editor).toContain("patchHeroBlock");
    expect(editor).not.toMatch(/\.json\s*\(/);

    const seeded = [
      {
        type: "hero",
        data: {
          eyebrow: "ISSA Build",
          headerLabel: "ISSA Build",
          teaser: "Honey Onyx. Multi Green Onyx. Crafted for light.",
        },
      },
    ];
    expect(readHeroEditorFields(seeded)).toEqual({
      title: "ISSA Build",
      text: "Honey Onyx. Multi Green Onyx. Crafted for light.",
    });

    const patched = patchHeroBlock(seeded, {
      title: "Edited title",
      text: "Edited teaser",
    });
    const hero = patched.find((block) => block.type === "hero")?.data as Record<string, string>;
    expect(hero.headerLabel).toBe("Edited title");
    expect(hero.teaser).toBe("Edited teaser");
    expect(hero.title).toBe("Edited title");
    expect(hero.text).toBe("Edited teaser");
  });
});
