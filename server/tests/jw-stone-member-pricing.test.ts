import ExcelJS from "exceljs";
import JSZip from "jszip";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  JW_STONE_PRICING_DRIVE_FILE_ID,
  JW_STONE_PRICING_DRIVE_FOLDER_ID,
} from "@shared/jwStoneMemberPricing";
import {
  JW_STONE_PRICING_HEADERS,
  JW_STONE_PRICING_QUANTITY_HEADER,
  getJwStoneDriveIdentityEmail,
  getJwStonePricingSnapshot,
  parseJwStonePricingWorkbook,
  resetJwStoneDrivePricingCacheForTests,
  validateJwStoneDriveFileMetadata,
} from "../services/jwStoneDrivePricing";
import { projectJwStonePricingResponse } from "../routes/jw-stone-member-pricing";
import {
  hasActiveJwStoneBusinessMembership,
  hasTradeScoutPricingAuthority,
  resolveJwStonePricingAccess,
} from "../services/jwStonePricingAccess";

async function pricingWorkbook(
  rows: readonly (readonly [string, number | null, number, number])[],
  firstHeader = JW_STONE_PRICING_HEADERS[0]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Fabricator Pricing");
  sheet.addRow([firstHeader, ...JW_STONE_PRICING_HEADERS.slice(1)]);
  rows.forEach((row) => sheet.addRow([...row]));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function withOwnerSpreadsheetNamespace(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  const spreadsheetNamespace = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const entries = Object.values(zip.files).filter(
    (entry) => !entry.dir && entry.name.startsWith("xl/") && entry.name.endsWith(".xml")
  );
  for (const entry of entries) {
    const xml = await entry.async("string");
    if (!xml.includes(`xmlns="${spreadsheetNamespace}"`)) continue;
    zip.file(
      entry.name,
      xml
        .replace(`xmlns="${spreadsheetNamespace}"`, `xmlns:x="${spreadsheetNamespace}"`)
        .replace(/<(\/?)((?:[A-Za-z][A-Za-z0-9.-]*))(?=[\s>])/g, "<$1x:$2")
    );
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

describe("JW Stone private member pricing", () => {
  it.each([undefined, null, 2, 3])(
    "preserves legacy bundles or explicit slab minima: %s",
    async (minimum) => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Fabricator Pricing");
      sheet.addRow([...JW_STONE_PRICING_HEADERS, JW_STONE_PRICING_QUANTITY_HEADER]);
      sheet.addRow(["Test Stone", null, 3, 2, minimum]);
      const snapshot = await parseJwStonePricingWorkbook(
        Buffer.from(await workbook.xlsx.writeBuffer()),
        "2026-09-06T03:00:00Z"
      );
      expect(snapshot.prices[0].bundleMinSlabs).toBe(minimum == null ? undefined : minimum);
      for (const access of ["member", "internal"] as const) {
        expect(
          projectJwStonePricingResponse({ snapshot, access, viewerId: "fixture" }).prices[0]
            .bundleMinSlabs
        ).toBe(minimum == null ? undefined : minimum);
      }
    }
  );

  it.each([1, 2.5, 1000, "2", { formula: "1+1", result: 2 }])(
    "rejects invalid quantity minima: %s",
    async (minimum) => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Fabricator Pricing");
      sheet.addRow([...JW_STONE_PRICING_HEADERS, JW_STONE_PRICING_QUANTITY_HEADER]);
      sheet.addRow(["Test Stone", null, 3, 2, minimum]);
      await expect(
        parseJwStonePricingWorkbook(
          Buffer.from(await workbook.xlsx.writeBuffer()),
          "2026-09-06T03:00:00Z"
        )
      ).rejects.toThrow(/bundle minimum/);
    }
  );

  it("rejects a quantity without its exact workbook header", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Fabricator Pricing");
    sheet.addRow([...JW_STONE_PRICING_HEADERS]);
    sheet.addRow(["Test Stone", null, 3, 2, 2]);
    await expect(
      parseJwStonePricingWorkbook(
        Buffer.from(await workbook.xlsx.writeBuffer()),
        "2026-09-06T03:00:00Z"
      )
    ).rejects.toThrow(/bundle minimum/);
  });
  it("mounts private pricing only after authentication and authority binding", () => {
    const routesSource = readFileSync("server/routes.ts", "utf8");
    const setupAuthIndex = routesSource.indexOf("await setupAuth(app);");
    const authorityIndex = routesSource.indexOf("app.use(bindAuthenticatedRequestAuthority);");
    const pricingIndex = routesSource.indexOf("registerJwStoneMemberPricingRoutes(app);");

    expect(setupAuthIndex).toBeGreaterThan(-1);
    expect(authorityIndex).toBeGreaterThan(setupAuthIndex);
    expect(pricingIndex).toBeGreaterThan(authorityIndex);
  });
  it("parses the exact Drive workbook contract into integer cents", async () => {
    const snapshot = await parseJwStonePricingWorkbook(
      await pricingWorkbook([
        ["Blue Dunes", 11, 20.5, 18.5],
        ["Bianco Carrara", null, 19.5, 14],
      ]),
      "2026-09-05T02:50:50.000Z"
    );

    expect(snapshot).toEqual({
      sourceUpdatedAt: "2026-09-05T02:50:50.000Z",
      prices: [
        {
          stoneName: "Blue Dunes",
          stoneKey: "blue dunes",
          landedCostCents: 1100,
          slabPriceCents: 2050,
          bundlePriceCents: 1850,
        },
        {
          stoneName: "Bianco Carrara",
          stoneKey: "bianco carrara",
          landedCostCents: null,
          slabPriceCents: 1950,
          bundlePriceCents: 1400,
        },
      ],
    });
  });

  it("supports the owner workbook's prefixed SpreadsheetML namespace", async () => {
    const ownerWorkbook = await withOwnerSpreadsheetNamespace(
      await pricingWorkbook([["Blue Dunes", 11, 20.5, 18.5]])
    );
    const snapshot = await parseJwStonePricingWorkbook(ownerWorkbook, "2026-09-05T02:50:50.000Z");
    expect(snapshot.prices).toHaveLength(1);
    expect(snapshot.prices[0]?.stoneKey).toBe("blue dunes");
  });

  it("fails closed on changed headers, duplicate stone keys, or invalid prices", async () => {
    await expect(
      parseJwStonePricingWorkbook(
        await pricingWorkbook([["Blue Dunes", 11, 20.5, 18.5]], "Material"),
        "2026-09-05T02:50:50.000Z"
      )
    ).rejects.toThrow(/header 1/i);

    await expect(
      parseJwStonePricingWorkbook(
        await pricingWorkbook([
          ["Blue Dunes", 11, 20.5, 18.5],
          ["Blue-Dunes", 11, 20.5, 18.5],
        ]),
        "2026-09-05T02:50:50.000Z"
      )
    ).rejects.toThrow(/duplicates/i);

    await expect(
      parseJwStonePricingWorkbook(
        await pricingWorkbook([["Blue Dunes", 11, 20.505, 18.5]]),
        "2026-09-05T02:50:50.000Z"
      )
    ).rejects.toThrow(/two decimal places/i);
  });

  it("accepts only the exact approved Drive file and parent folder", () => {
    const metadata = {
      id: JW_STONE_PRICING_DRIVE_FILE_ID,
      name: "JW_Stone_Fabricator_Pricing_Draft_119 (1).xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      modifiedTime: "2026-09-05T02:50:50.000Z",
      parents: [JW_STONE_PRICING_DRIVE_FOLDER_ID],
      trashed: false,
      size: "8155",
    };
    expect(() =>
      validateJwStoneDriveFileMetadata(metadata, {
        fileId: JW_STONE_PRICING_DRIVE_FILE_ID,
        folderId: JW_STONE_PRICING_DRIVE_FOLDER_ID,
      })
    ).not.toThrow();
    expect(() =>
      validateJwStoneDriveFileMetadata(
        { ...metadata, parents: ["another-folder"] },
        {
          fileId: JW_STONE_PRICING_DRIVE_FILE_ID,
          folderId: JW_STONE_PRICING_DRIVE_FOLDER_ID,
        }
      )
    ).toThrow(/outside the approved Drive folder/i);
  });

  it("reads the exact private Drive file through the bounded server path", async () => {
    const workbook = await pricingWorkbook([["Blue Dunes", 11, 20.5, 18.5]]);
    const priorEnv = {
      refreshToken: process.env.JW_STONE_DRIVE_REFRESH_TOKEN,
      serviceAccount: process.env.JW_STONE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64,
      applicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };
    process.env.JW_STONE_DRIVE_REFRESH_TOKEN = "test-refresh-token";
    delete process.env.JW_STONE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    resetJwStoneDrivePricingCacheForTests();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "test-access-token", expires_in: 3600 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: JW_STONE_PRICING_DRIVE_FILE_ID,
            name: "JW_Stone_Fabricator_Pricing_Draft_119 (1).xlsx",
            mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            modifiedTime: "2026-09-05T02:50:50.000Z",
            parents: [JW_STONE_PRICING_DRIVE_FOLDER_ID],
            trashed: false,
            size: String(workbook.length),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(workbook, {
          status: 200,
          headers: { "Content-Length": String(workbook.length) },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    try {
      const snapshot = await getJwStonePricingSnapshot({ forceRefresh: true });
      expect(snapshot.prices).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://oauth2.googleapis.com/token");
      expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
        `/drive/v3/files/${JW_STONE_PRICING_DRIVE_FILE_ID}`
      );
      expect(String(fetchMock.mock.calls[2]?.[0])).toContain("alt=media");
    } finally {
      vi.unstubAllGlobals();
      resetJwStoneDrivePricingCacheForTests();
      const restore = (key: string, value: string | undefined) => {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      };
      restore("JW_STONE_DRIVE_REFRESH_TOKEN", priorEnv.refreshToken);
      restore("JW_STONE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64", priorEnv.serviceAccount);
      restore("GOOGLE_APPLICATION_CREDENTIALS", priorEnv.applicationCredentials);
      restore("GOOGLE_CLIENT_ID", priorEnv.clientId);
      restore("GOOGLE_CLIENT_SECRET", priorEnv.clientSecret);
    }
  });

  it("identifies the configured Drive service account without exposing its key", async () => {
    const priorEnv = {
      serviceAccount: process.env.JW_STONE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64,
      applicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      refreshToken: process.env.JW_STONE_DRIVE_REFRESH_TOKEN,
    };
    process.env.JW_STONE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64 = Buffer.from(
      JSON.stringify({
        client_email: "jw-stone-pricing@example.iam.gserviceaccount.com",
        private_key: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
      })
    ).toString("base64");
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.JW_STONE_DRIVE_REFRESH_TOKEN;

    try {
      await expect(getJwStoneDriveIdentityEmail()).resolves.toBe(
        "jw-stone-pricing@example.iam.gserviceaccount.com"
      );
    } finally {
      const restore = (key: string, value: string | undefined) => {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      };
      restore("JW_STONE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64", priorEnv.serviceAccount);
      restore("GOOGLE_APPLICATION_CREDENTIALS", priorEnv.applicationCredentials);
      restore("JW_STONE_DRIVE_REFRESH_TOKEN", priorEnv.refreshToken);
      resetJwStoneDrivePricingCacheForTests();
    }
  });
  it("never projects landed cost to a business member", () => {
    const snapshot = {
      sourceUpdatedAt: "2026-09-05T02:50:50.000Z",
      prices: [
        {
          stoneName: "Blue Dunes",
          stoneKey: "blue dunes",
          landedCostCents: 1100,
          slabPriceCents: 2050,
          bundlePriceCents: 1850,
        },
      ],
    } as const;
    const member = projectJwStonePricingResponse({
      snapshot,
      access: "member",
      viewerId: "member-1",
    });
    const internal = projectJwStonePricingResponse({
      snapshot,
      access: "internal",
      viewerId: "admin-1",
    });

    expect(JSON.stringify(member)).not.toMatch(/landed|cost/i);
    expect(JSON.stringify(internal)).toContain('"landedCostCents":1100');
  });

  it("recognizes TradeScout admin authority and requires an exact active membership row", async () => {
    expect(hasTradeScoutPricingAuthority({ role: "super_admin" })).toBe(true);
    expect(hasTradeScoutPricingAuthority({ role: "owner" })).toBe(true);
    expect(hasTradeScoutPricingAuthority({ isAdmin: true })).toBe(true);
    expect(hasTradeScoutPricingAuthority({ role: "homeowner" })).toBe(false);

    const query = vi.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] });
    await expect(hasActiveJwStoneBusinessMembership("member-1", { query } as any)).resolves.toBe(
      true
    );
    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0]?.[1]).toEqual(["member-1", "jw_stone_member_pricing"]);
    expect(String(query.mock.calls[0]?.[0])).toContain("account.status = 'active'");
    expect(String(query.mock.calls[0]?.[0])).toContain("entitlement.status = 'active'");
    expect(String(query.mock.calls[0]?.[0])).toContain("target_profile.slug = 'jw-stone'");
  });

  it("grants internal pricing to the exact JW profile or business owner", async () => {
    const target = {
      profileId: "jw-profile",
      profileSlug: "jw-stone",
      profileStatus: "published",
      ownerUserId: "profile-owner",
      businessId: "jw-business",
      businessOwnerUserId: "business-owner",
    } as const;

    await expect(
      resolveJwStonePricingAccess({ userId: "profile-owner", user: {}, target })
    ).resolves.toBe("internal");
    await expect(
      resolveJwStonePricingAccess({ userId: "business-owner", user: {}, target })
    ).resolves.toBe("internal");
  });
});
