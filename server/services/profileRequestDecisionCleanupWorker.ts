import { logger } from "./logger";
import { profileRequestDecisionService } from "./profileRequestDecisionService";

type CleanupService = Pick<typeof profileRequestDecisionService, "drainExpired">;
type CleanupLogger = Pick<typeof logger, "info" | "error">;

type CleanupWorkerOptions = {
  intervalMs?: number;
  batchSize?: number;
  maxBatches?: number;
  logger?: CleanupLogger;
};

function configuredPositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Security-retention worker for the short-lived anonymous request proofs.
 * It is intentionally independent of the optional crawler scheduler: every
 * application process drains once at boot, periodically while alive, and once
 * more before its database pool closes.
 */
export class ProfileRequestDecisionCleanupWorker {
  private readonly intervalMs: number;
  private readonly batchSize: number;
  private readonly maxBatches: number;
  private readonly log: CleanupLogger;
  private timer: ReturnType<typeof setInterval> | null = null;
  private inFlight: Promise<number> | null = null;

  constructor(
    private readonly service: CleanupService = profileRequestDecisionService,
    options: CleanupWorkerOptions = {}
  ) {
    this.intervalMs = configuredPositiveInteger(
      options.intervalMs ?? process.env.PROFILE_REQUEST_DECISION_CLEANUP_INTERVAL_MS,
      60_000
    );
    this.batchSize = Math.min(configuredPositiveInteger(options.batchSize, 200), 1_000);
    this.maxBatches = Math.min(configuredPositiveInteger(options.maxBatches, 100), 10_000);
    this.log = options.logger || logger;
  }

  private drainSafely(reason: "startup" | "interval" | "shutdown"): Promise<number> {
    if (this.inFlight) return this.inFlight;

    const operation = this.service
      .drainExpired({ batchSize: this.batchSize, maxBatches: this.maxBatches })
      .then((deleted) => {
        if (deleted > 0) {
          this.log.info("[profile-request-decision] expired proof state drained", {
            reason,
            deleted,
          });
        }
        return deleted;
      })
      .catch((error) => {
        this.log.error("[profile-request-decision] expired proof cleanup failed", {
          reason,
          error,
        });
        return 0;
      })
      .finally(() => {
        if (this.inFlight === operation) this.inFlight = null;
      });
    this.inFlight = operation;
    return operation;
  }

  start(): Promise<number> {
    if (this.timer) return this.inFlight || Promise.resolve(0);

    this.timer = setInterval(() => {
      void this.drainSafely("interval");
    }, this.intervalMs);
    this.timer.unref?.();
    return this.drainSafely("startup");
  }

  async stop(options: { drain?: boolean } = {}): Promise<number> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.inFlight) await this.inFlight;
    return options.drain === false ? 0 : this.drainSafely("shutdown");
  }
}

const profileRequestDecisionCleanupWorker = new ProfileRequestDecisionCleanupWorker();

export function startProfileRequestDecisionCleanupWorker(): Promise<number> {
  return profileRequestDecisionCleanupWorker.start();
}

export function stopProfileRequestDecisionCleanupWorker(options?: {
  drain?: boolean;
}): Promise<number> {
  return profileRequestDecisionCleanupWorker.stop(options);
}
