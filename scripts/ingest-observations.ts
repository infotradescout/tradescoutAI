import "dotenv/config";
import { runHomeScoutObservationAdapter } from "../server/ingestion/runObservationsIngestion";

function argValue(flag: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function main() {
  const countyFips = argValue("--countyFips") || process.env.OBS_COUNTY_FIPS;
  const stateCodeRaw = argValue("--stateCode") || process.env.OBS_STATE_CODE;
  const stateCode = stateCodeRaw ? stateCodeRaw.toUpperCase() : undefined;
  const limitRaw = argValue("--limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;

  if (!countyFips || !stateCode) {
    throw new Error(
      "Missing county/state. Use --countyFips 12033 --stateCode FL (or OBS_COUNTY_FIPS/OBS_STATE_CODE env vars)."
    );
  }

  const result = await runHomeScoutObservationAdapter({
    countyFips,
    stateCode,
    limit,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        adapter: "homeScoutListingsObservationAdapter",
        ...result,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    "[ingest-observations] failed:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
