  if (check.publicationRules) {
    const rulesResult = await client.query(
      "select exists (select 1 from ts_publication_rules where id = 'default') as present"
    );
    check.defaultPublicationRule = Boolean(rulesResult.rows?.[0]?.present);
  }

  const { inspectScoutReceiptSchema } = await import("./lib/scout-receipt-schema.mjs");
  const receiptSchema = await inspectScoutReceiptSchema(client);
  check.scoutExecutionReceiptsContract = receiptSchema.contract;
  check.scoutExecutionReceiptsMigrationRecorded = receiptSchema.migrationRecorded;
  const missing = [...evaluateRequiredProductionSchema(check), ...receiptSchema.missing];
  if (missing.length > 0) {
    throw new Error(
      [
        `Required production schema is missing: ${missing.join(", ")}`,
        DATABASE_RECOVERY_GUIDANCE,
      ].join(" ")
    );
  }

  return check;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL must be set");
