import { ApiError } from "./domain.js";

// Per-user write limit held in memory: an abuse backstop that costs no database write per request.
// Sign-in, password and other security limits stay durable in PostgreSQL (see auth.ts throttle).
// With several instances each keeps its own window, so the effective ceiling scales with instances.
export class ActionLimiter {
  private windows = new Map<string, { count: number; resetAt: number }>();
  private sweep: NodeJS.Timeout;
  constructor(
    private limit: number,
    private windowMs = 60000,
  ) {
    // Drop expired windows so memory stays proportional to recently active users.
    this.sweep = setInterval(() => {
      const now = Date.now();
      for (const [key, w] of this.windows) if (w.resetAt <= now) this.windows.delete(key);
    }, windowMs);
    this.sweep.unref();
  }
  hit(key: string, now = Date.now()) {
    let w = this.windows.get(key);
    if (!w || w.resetAt <= now) this.windows.set(key, (w = { count: 0, resetAt: now + this.windowMs }));
    w.count++;
    if (w.count > this.limit) throw new ApiError(429, "Too many requests. Try again later");
    return w.count;
  }
  close() {
    clearInterval(this.sweep);
  }
}
