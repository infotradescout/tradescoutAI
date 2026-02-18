import "dotenv/config";
import { runObservationAdapter } from "../server/ingestion/runObservationsIngestion";
import { homeScoutListingsObservationAdapter } from "../server/ingestion/adapters/homeScoutListingsAdapter";
import { permitsObservationAdapter } from "../server/ingestion/adapters/permitsObservationAdapter";
import { inspectionsObservationAdapter } from "../server/ingestion/adapters/inspectionsObservationAdapter";

function argValue(flag: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function main() {
  const adapterName = (argValue("--adapter") || process.env.OBS_ADAPTER || "listing").toLowerCase();
  const countyFips = argValue("--countyFips") || process.env.OBS_COUNTY_FIPS;
  const stateCodeRaw = argValue("--stateCode") || process.env.OBS_STATE_CODE;
  const stateCode = stateCodeRaw ? stateCodeRaw.toUpperCase() : undefined;
  const limitRaw = argValue("--limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;
  const inputFilePath = argValue("--inputFilePath") || process.env.OBS_INPUT_FILE_PATH;

  if (!countyFips || !stateCode) {
    throw new Error(
      "Missing county/state. Use --countyFips 12033 --stateCode FL (or OBS_COUNTY_FIPS/OBS_STATE_CODE env vars)."
    );
  }

  const adapters = {
    listing: homeScoutListingsObservationAdapter,
    permit: permitsObservationAdapter,
    inspection: inspectionsObservationAdapter,
  } as const;

  const adapter = (adapters as Record<string, (typeof adapters)[keyof typeof adapters]>)[
    adapterName
  ];
  if (!adapter) {
    throw new Error(`Unknown adapter "${adapterName}". Use one of: listing, permit, inspection`);
  }

  if ((adapterName === "permit" || adapterName === "inspection") && !inputFilePath) {
    throw new Error(
      `Adapter "${adapterName}" requires --inputFilePath (or OBS_INPUT_FILE_PATH) pointing to real source data JSON.`
    );
  }

  const result = await runObservationAdapter({
    adapter,
    countyFips,
    stateCode,
    limit,
    config: inputFilePath ? { inputFilePath } : undefined,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        adapter: adapterName,
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
