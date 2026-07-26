export type BoundedConcurrencyResult<T> =
  | { accepted: true; value: T }
  | { accepted: false };

type PendingPermit = {
  resolve: (release: (() => void) | null) => void;
};

export class BoundedConcurrencyGate {
  private readonly maxConcurrent: number;
  private readonly maxQueued: number;
  private active = 0;
  private readonly pending: PendingPermit[] = [];

  constructor(options: { maxConcurrent: number; maxQueued: number }) {
    const maxConcurrent = Number.isFinite(options.maxConcurrent) ? options.maxConcurrent : 1;
    const maxQueued = Number.isFinite(options.maxQueued) ? options.maxQueued : 0;
    this.maxConcurrent = Math.max(1, Math.floor(maxConcurrent));
    this.maxQueued = Math.max(0, Math.floor(maxQueued));
  }

  async run<T>(task: () => Promise<T>): Promise<BoundedConcurrencyResult<T>> {
    const release = await this.acquire();
    if (!release) return { accepted: false };

    try {
      return { accepted: true, value: await task() };
    } finally {
      release();
    }
  }

  snapshot() {
    return {
      active: this.active,
      queued: this.pending.length,
      maxConcurrent: this.maxConcurrent,
      maxQueued: this.maxQueued,
    };
  }

  private acquire(): Promise<(() => void) | null> {
    if (this.active < this.maxConcurrent) {
      this.active += 1;
      return Promise.resolve(this.buildRelease());
    }

    if (this.pending.length >= this.maxQueued) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      this.pending.push({ resolve });
    });
  }

  private buildRelease(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;

      const next = this.pending.shift();
      if (next) {
        next.resolve(this.buildRelease());
        return;
      }

      this.active = Math.max(0, this.active - 1);
    };
  }
}
