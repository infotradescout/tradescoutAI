export type BoundedTaskQueueStats = {
  active: number;
  queued: number;
  maxConcurrent: number;
  maxOutstanding: number;
  maxRetries: number;
  accepted: number;
  dropped: number;
  completed: number;
  retried: number;
  failed: number;
};

export class BoundedTaskQueue {
  private readonly maxConcurrent: number;
  private readonly maxOutstanding: number;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly shouldRetry: (error: unknown) => boolean;
  private readonly onFinalError?: (error: unknown) => void;
  private active = 0;
  private readonly pending: Array<() => Promise<void>> = [];
  private readonly idleWaiters: Array<() => void> = [];
  private accepted = 0;
  private dropped = 0;
  private completed = 0;
  private retried = 0;
  private failed = 0;

  constructor(options: {
    maxConcurrent: number;
    maxOutstanding: number;
    maxRetries?: number;
    baseBackoffMs?: number;
    maxBackoffMs?: number;
    shouldRetry?: (error: unknown) => boolean;
    onFinalError?: (error: unknown) => void;
  }) {
    const maxConcurrent = Number.isFinite(options.maxConcurrent) ? options.maxConcurrent : 1;
    const maxOutstanding = Number.isFinite(options.maxOutstanding)
      ? options.maxOutstanding
      : maxConcurrent;
    const maxRetries = Number.isFinite(Number(options.maxRetries)) ? Number(options.maxRetries) : 0;
    const baseBackoffMs = Number.isFinite(Number(options.baseBackoffMs))
      ? Number(options.baseBackoffMs)
      : 0;
    const maxBackoffMs = Number.isFinite(Number(options.maxBackoffMs))
      ? Number(options.maxBackoffMs)
      : baseBackoffMs;
    this.maxConcurrent = Math.max(1, Math.floor(maxConcurrent));
    this.maxOutstanding = Math.max(this.maxConcurrent, Math.floor(maxOutstanding));
    this.maxRetries = Math.max(0, Math.floor(maxRetries));
    this.baseBackoffMs = Math.max(0, Math.floor(baseBackoffMs));
    this.maxBackoffMs = Math.max(
      this.baseBackoffMs,
      Math.floor(maxBackoffMs)
    );
    this.shouldRetry = options.shouldRetry || (() => false);
    this.onFinalError = options.onFinalError;
  }

  enqueue(task: () => Promise<void>): boolean {
    if (this.active + this.pending.length >= this.maxOutstanding) {
      this.dropped += 1;
      return false;
    }

    this.accepted += 1;
    this.pending.push(task);
    this.pump();
    return true;
  }

  snapshot(): BoundedTaskQueueStats {
    return {
      active: this.active,
      queued: this.pending.length,
      maxConcurrent: this.maxConcurrent,
      maxOutstanding: this.maxOutstanding,
      maxRetries: this.maxRetries,
      accepted: this.accepted,
      dropped: this.dropped,
      completed: this.completed,
      retried: this.retried,
      failed: this.failed,
    };
  }

  whenIdle(): Promise<void> {
    if (this.active === 0 && this.pending.length === 0) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  private pump(): void {
    while (this.active < this.maxConcurrent && this.pending.length > 0) {
      const task = this.pending.shift();
      if (!task) break;
      this.active += 1;
      void this.runTask(task).finally(() => {
        this.active = Math.max(0, this.active - 1);
        this.pump();
        this.resolveIdleWaitersIfNeeded();
      });
    }
  }

  private async runTask(task: () => Promise<void>): Promise<void> {
    let attempt = 0;
    while (true) {
      try {
        await task();
        this.completed += 1;
        return;
      } catch (error) {
        if (attempt >= this.maxRetries || !this.shouldRetry(error)) {
          this.failed += 1;
          this.onFinalError?.(error);
          return;
        }

        const backoffMs = Math.min(
          this.maxBackoffMs,
          this.baseBackoffMs * Math.pow(2, attempt)
        );
        attempt += 1;
        this.retried += 1;
        if (backoffMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }
  }

  private resolveIdleWaitersIfNeeded(): void {
    if (this.active !== 0 || this.pending.length !== 0) return;
    const waiters = this.idleWaiters.splice(0);
    for (const resolve of waiters) resolve();
  }
}
