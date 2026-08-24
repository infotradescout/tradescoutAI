import {
  JW_STONE_CONFIRMED_STOCK_LOTS,
  JW_STONE_CONFIRMED_STOCK_FIXTURE_VERSION,
} from "@shared/stoneInventory";

const applying = process.argv.includes("--apply");
const production = String(process.env.NODE_ENV || "").toLowerCase() === "production";

if (!applying) {
  process.stdout.write(
    `${JSON.stringify(
      {
        mode: "dry-run",
        fixtureVersion: JW_STONE_CONFIRMED_STOCK_FIXTURE_VERSION,
        lots: JW_STONE_CONFIRMED_STOCK_LOTS,
        buyerVisibleOnImport: false,
        applyCommand:
          "node --import tsx -r dotenv/config scripts/backfill-jw-stone-confirmed-stock.ts --apply",
      },
      null,
      2
    )}\n`
  );
  process.exit(0);
}

if (production && process.env.ALLOW_JW_STONE_STOCK_BACKFILL !== "true") {
  throw new Error(
    "Production backfill is disabled. Use an authorized runbook and set ALLOW_JW_STONE_STOCK_BACKFILL=true only for that execution."
  );
}

const { importJwStoneConfirmedStock } = await import(
  "../server/services/jwStoneConfirmedStock"
);
const { pool } = await import("../server/db");

try {
  const result = await importJwStoneConfirmedStock();
  process.stdout.write(`${JSON.stringify({ mode: "applied", ...result }, null, 2)}\n`);
} finally {
  await pool.end();
}
