import { randomUUID, timingSafeEqual, createHash } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Config } from "./config.js";
import type { Db } from "./db.js";

// In-process counters exposed in Prometheus text format. Each instance reports its own values;
// the monitoring system sums across instances.
const latencyBuckets = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30];
const requests = new Map<string, number>(); // key: method|route|statusClass
const latency = new Map<string, { buckets: number[]; sum: number; count: number }>(); // key: route
let inflight = 0;
export const workerStats = { running: 0, completed: 0, failed: 0, retried: 0, slots: 0 };

const requestIdPattern = /^[A-Za-z0-9._-]{8,128}$/;
// Use the caller's request ID when it is well formed (for example from a proxy), otherwise a new UUID.
export function requestId(req: { headers: Record<string, string | string[] | undefined> }) {
  const incoming = req.headers["x-request-id"];
  return typeof incoming === "string" && requestIdPattern.test(incoming) ? incoming : randomUUID();
}

// Pino options for Google Cloud Logging: severity names, `message` key and a trace link when known.
export function loggerOptions(config: Config) {
  if (config.NODE_ENV === "test") return false as const;
  return {
    level: process.env.LOG_LEVEL || "info",
    messageKey: "message",
    redact: ["req.headers.cookie", "req.headers.authorization", "res.headers.set-cookie"],
    formatters: {
      level: (label: string, number: number) => ({
        severity: label === "fatal" ? "CRITICAL" : label === "warn" ? "WARNING" : label.toUpperCase(),
        level: number,
      }),
    },
  };
}

// Cloud Run sends X-Cloud-Trace-Context; with the project ID this links each log line to its trace.
export function traceFields(req: FastifyRequest) {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const header = req.headers["x-cloud-trace-context"];
  if (!project || typeof header !== "string") return {};
  const trace = header.split("/")[0];
  return trace && /^[a-f0-9]{32}$/i.test(trace)
    ? { "logging.googleapis.com/trace": `projects/${project}/traces/${trace}` }
    : {};
}

// Error Reporting groups by stack frames. The message line is replaced so request data or
// database values inside error messages never reach the logs.
export function reportableError(error: unknown) {
  const name = error instanceof Error ? error.name : "Error";
  const frames = error instanceof Error && error.stack ? error.stack.split("\n").slice(1, 30).join("\n") : "";
  return {
    "@type": "type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent",
    stack_trace: `${name}: [message withheld]\n${frames}`,
    errorName: name,
    errorCode: typeof (error as { code?: unknown })?.code === "string" ? (error as { code: string }).code : undefined,
  };
}

export function registerRequestMetrics(app: FastifyInstance) {
  app.addHook("onRequest", async (req, reply) => {
    inflight++;
    reply.header("X-Request-Id", req.id);
  });
  app.addHook("onResponse", async (req, reply) => {
    inflight--;
    // Label by declared route pattern, never by raw URL, so IDs do not create unbounded series.
    const route = req.routeOptions.url ?? "unmatched";
    const key = `${req.method}|${route}|${Math.floor(reply.statusCode / 100)}xx`;
    requests.set(key, (requests.get(key) ?? 0) + 1);
    const seconds = reply.elapsedTime / 1000;
    let entry = latency.get(route);
    if (!entry) latency.set(route, (entry = { buckets: latencyBuckets.map(() => 0), sum: 0, count: 0 }));
    latencyBuckets.forEach((limit, i) => {
      if (seconds <= limit) entry.buckets[i]!++;
    });
    entry.sum += seconds;
    entry.count++;
  });
}

export interface QueueState {
  pending: number;
  running: number;
  failed24h: number;
  oldestPendingSeconds: number;
}
export async function queueState(db: Db): Promise<QueueState> {
  const [row] = await db.$queryRaw<
    Array<{ pending: bigint; running: bigint; failed: bigint; oldest: number | null }>
  >`SELECT
      COUNT(*) FILTER (WHERE "state"='PENDING') AS pending,
      COUNT(*) FILTER (WHERE "state"='RUNNING') AS running,
      COUNT(*) FILTER (WHERE "state"='FAILED' AND "createdAt" > (NOW() AT TIME ZONE 'UTC') - INTERVAL '1 day') AS failed,
      EXTRACT(EPOCH FROM (NOW() AT TIME ZONE 'UTC') - MIN("createdAt") FILTER (WHERE "state"='PENDING'))::float8 AS oldest
    FROM "EvaluationJob"`;
  return {
    pending: Number(row?.pending ?? 0),
    running: Number(row?.running ?? 0),
    failed24h: Number(row?.failed ?? 0),
    oldestPendingSeconds: Math.round(row?.oldest ?? 0),
  };
}

const escapeLabel = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
export async function metricsText(db: Db) {
  const lines: string[] = [];
  const metric = (name: string, type: string, help: string) =>
    lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`);
  metric("portal_http_requests_total", "counter", "HTTP requests by method, route and status class.");
  for (const [key, value] of requests) {
    const [method, route, status] = key.split("|") as [string, string, string];
    lines.push(
      `portal_http_requests_total{method="${method}",route="${escapeLabel(route)}",status="${status}"} ${value}`,
    );
  }
  metric("portal_http_request_duration_seconds", "histogram", "HTTP request duration by route.");
  for (const [route, entry] of latency) {
    const label = escapeLabel(route);
    latencyBuckets.forEach((limit, i) =>
      lines.push(`portal_http_request_duration_seconds_bucket{route="${label}",le="${limit}"} ${entry.buckets[i]}`),
    );
    lines.push(`portal_http_request_duration_seconds_bucket{route="${label}",le="+Inf"} ${entry.count}`);
    lines.push(`portal_http_request_duration_seconds_sum{route="${label}"} ${entry.sum}`);
    lines.push(`portal_http_request_duration_seconds_count{route="${label}"} ${entry.count}`);
  }
  metric("portal_http_inflight_requests", "gauge", "Requests being handled now.");
  lines.push(`portal_http_inflight_requests ${inflight}`);
  metric("portal_worker_jobs_total", "counter", "Evaluation jobs finished by this instance, by outcome.");
  lines.push(`portal_worker_jobs_total{outcome="completed"} ${workerStats.completed}`);
  lines.push(`portal_worker_jobs_total{outcome="retried"} ${workerStats.retried}`);
  lines.push(`portal_worker_jobs_total{outcome="failed"} ${workerStats.failed}`);
  metric("portal_worker_running_jobs", "gauge", "Evaluation jobs running in this instance.");
  lines.push(`portal_worker_running_jobs ${workerStats.running}`);
  metric("portal_worker_slots", "gauge", "Configured parallel evaluation slots in this instance.");
  lines.push(`portal_worker_slots ${workerStats.slots}`);
  const queue = await queueState(db);
  metric("portal_queue_jobs", "gauge", "Evaluation jobs in the shared queue by state.");
  lines.push(
    `portal_queue_jobs{state="pending"} ${queue.pending}`,
    `portal_queue_jobs{state="running"} ${queue.running}`,
  );
  metric("portal_queue_failed_jobs_24h", "gauge", "Evaluation jobs that failed in the last 24 hours.");
  lines.push(`portal_queue_failed_jobs_24h ${queue.failed24h}`);
  metric("portal_queue_oldest_pending_seconds", "gauge", "Age of the oldest pending evaluation job.");
  lines.push(`portal_queue_oldest_pending_seconds ${queue.oldestPendingSeconds}`);
  const memory = process.memoryUsage();
  metric("portal_process_resident_memory_bytes", "gauge", "Resident memory of this process.");
  lines.push(`portal_process_resident_memory_bytes ${memory.rss}`);
  metric("portal_process_uptime_seconds", "gauge", "Seconds since this process started.");
  lines.push(`portal_process_uptime_seconds ${Math.round(process.uptime())}`);
  return lines.join("\n") + "\n";
}

// Constant-time bearer token check; metrics stay off unless METRICS_TOKEN is configured.
export function metricsAuthorized(header: string | undefined, token: string | undefined) {
  if (!token || !header?.startsWith("Bearer ")) return false;
  const a = createHash("sha256").update(header.slice(7)).digest();
  const b = createHash("sha256").update(token).digest();
  return timingSafeEqual(a, b);
}

// Health endpoints shared by the API and the worker-only process.
export function registerHealthRoutes(app: FastifyInstance, db: Db, config: Config) {
  app.get("/api/health", async () => {
    await db.$queryRaw`SELECT 1`;
    const revision = process.env.RENDER_GIT_COMMIT ?? process.env.K_REVISION;
    return { status: "ok", ...(revision && /^[A-Za-z0-9._-]{1,80}$/.test(revision) ? { revision } : {}) };
  });
  // Readiness: the database answers. Queue figures never fail the check, so a slow AI provider
  // cannot take an instance out of service; they are shown only to the metrics token holder.
  app.get("/api/health/ready", async (req, reply) => {
    try {
      await db.$queryRaw`SELECT 1`;
    } catch {
      return reply.code(503).send({ status: "unavailable", database: "unreachable" });
    }
    if (!metricsAuthorized(req.headers.authorization, config.METRICS_TOKEN)) return { status: "ready", database: "ok" };
    return { status: "ready", database: "ok", queue: await queueState(db), worker: { ...workerStats } };
  });
  app.get("/api/metrics", async (req, reply) => {
    if (!metricsAuthorized(req.headers.authorization, config.METRICS_TOKEN))
      return reply.code(404).send({ message: "API route not found" });
    return reply.type("text/plain; version=0.0.4").send(await metricsText(db));
  });
}
