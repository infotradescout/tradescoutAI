import { describe, expect, it, vi } from "vitest";
import { listProfileGalleryItems } from "@shared/profileGalleryShare";
import {
  collectPublicProfileIndexNowReconciliationUrls,
  fingerprintPublicProfileIndexNowUrls,
  reconcilePublicProfileIndexNow,
} from "../services/publicProfileIndexNowReconciliation";

const contentBlocks = [
  {
    type: "inventoryCatalog",
    data: {
      categories: [
        {
          category: "Stone",
          categorySlug: "stone",
          stones: [
            {
              name: "Named Stone",
              slug: "named-stone",
              images: ["/images/named-stone.jpg"],
            },
            {
              name: "Internal placeholder",
              nameStatus: "placeholder",
              slug: "trending-selection-04",
              images: ["/images/trending-selection-04.jpg"],
            },
          ],
        },
      ],
    },
  },
  {
    type: "gallery",
    data: {
      title: "Completed work",
      description: "Work records published by the public profile owner.",
      images: [
        "/images/generic-gallery-photo.jpg",
        {
          imageUrl: "/images/completed-stone-installation.jpg",
          title: "Completed stone installation",
          description:
            "A source-backed completed project record published by the public profile owner.",
        },
      ],
    },
  },
] as const;

const eligibleProfile = {
  slug: "source-backed-profile",
  status: "published",
  contentBlocks,
  seoMeta: {},
};

describe("public profile IndexNow reconciliation", () => {
  it("collects the same current and future child graph while excluding thin and foreign-host pages", () => {
    const gallery = listProfileGalleryItems(contentBlocks);
    const genericPhoto = gallery[0];
    const completedProject = gallery[1];
    const urls = collectPublicProfileIndexNowReconciliationUrls([
      eligibleProfile,
      {
        ...eligibleProfile,
        slug: "custom-domain-profile",
        seoMeta: { customDomain: "profile.example" },
      },
      {
        ...eligibleProfile,
        slug: "jrs-auto-glass",
      },
      {
        ...eligibleProfile,
        slug: "draft-profile",
        status: "draft",
      },
    ]);

    expect(urls).toEqual([
      "https://www.thetradescout.com/u/source-backed-profile",
      "https://www.thetradescout.com/u/source-backed-profile/categories/stone",
      `https://www.thetradescout.com/u/source-backed-profile/gallery/${completedProject.slug}`,
      "https://www.thetradescout.com/u/source-backed-profile/inventory/named-stone",
    ]);
    expect(urls.join("\n")).not.toContain("trending-selection-04");
    expect(urls.join("\n")).not.toContain(genericPhoto.slug);
    expect(urls.join("\n")).not.toContain("custom-domain-profile");
    expect(urls.join("\n")).not.toContain("jrs-auto-glass");
    expect(urls.join("\n")).not.toContain("draft-profile");
  });

  it("fingerprints the URL graph deterministically", () => {
    expect(
      fingerprintPublicProfileIndexNowUrls(["https://example/a", "https://example/b"])
    ).toBe(
      fingerprintPublicProfileIndexNowUrls([
        "https://example/b",
        "https://example/a",
        "https://example/a",
      ])
    );
    expect(fingerprintPublicProfileIndexNowUrls([])).toBeNull();
  });

  it("submits and records a new graph once", async () => {
    const writes: Array<{ text: string; values?: unknown[] }> = [];
    const queryable = {
      query: vi.fn(async (text: string, values?: unknown[]) => {
        if (/select 1/i.test(text)) return { rows: [] };
        writes.push({ text, values });
        return { rows: [] };
      }),
    };
    const submit = vi.fn(async (urls: Iterable<string>) => ({
      status: "submitted" as const,
      submittedUrlCount: [...urls].length,
    }));

    const result = await reconcilePublicProfileIndexNow({
      candidates: [eligibleProfile],
      queryable,
      submit,
      now: () => new Date("2026-08-25T02:00:00.000Z"),
    });

    expect(result.status).toBe("submitted");
    expect(result.profileCount).toBe(1);
    expect(result.urlCount).toBe(4);
    expect(result.submittedUrlCount).toBe(4);
    expect(result.batchCount).toBe(1);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(writes).toHaveLength(1);
    const eventData = JSON.parse(String(writes[0].values?.[1] || "{}"));
    expect(eventData).toMatchObject({
      status: "submitted",
      profileCount: 1,
      urlCount: 4,
      submittedUrlCount: 4,
      batchCount: 1,
      occurredAt: "2026-08-25T02:00:00.000Z",
    });
    expect(eventData.evidenceBoundary).toContain("not proof of indexing");
  });

  it("skips an unchanged graph after a successful fingerprint record", async () => {
    const queryable = {
      query: vi.fn(async (text: string) => ({ rows: /select 1/i.test(text) ? [{ exists: 1 }] : [] })),
    };
    const submit = vi.fn();

    const result = await reconcilePublicProfileIndexNow({
      candidates: [eligibleProfile],
      queryable,
      submit,
    });

    expect(result.status).toBe("skipped");
    expect(result.urlCount).toBe(4);
    expect(result.submittedUrlCount).toBe(0);
    expect(submit).not.toHaveBeenCalled();
    expect(queryable.query).toHaveBeenCalledTimes(1);
  });

  it("records a disabled key state without falsely marking the graph submitted", async () => {
    const writes: Array<{ values?: unknown[] }> = [];
    const queryable = {
      query: vi.fn(async (text: string, values?: unknown[]) => {
        if (/select 1/i.test(text)) return { rows: [] };
        writes.push({ values });
        return { rows: [] };
      }),
    };

    const result = await reconcilePublicProfileIndexNow({
      candidates: [eligibleProfile],
      queryable,
      submit: vi.fn(async () => ({ status: "disabled" as const, submittedUrlCount: 0 })),
      now: () => new Date("2026-08-25T02:00:00.000Z"),
    });

    expect(result.status).toBe("disabled");
    expect(result.submittedUrlCount).toBe(0);
    expect(writes).toHaveLength(1);
    const eventData = JSON.parse(String(writes[0].values?.[1] || "{}"));
    expect(eventData.status).toBe("disabled");
    expect(eventData.detail).toContain("retried later");
  });
});
