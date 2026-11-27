import Fastify from "fastify";
import { database } from "./db.js";
import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";
import { startWorker } from "./worker.js";
import { loggerOptions, registerHealthRoutes, requestId } from "./observability.js";

const config = loadConfig();
const db = database(config.DATABASE_URL);
await db.$connect();

// WORKER_MODE=only runs evaluation jobs with just the health and metrics routes (for a separate
// Cloud Run worker service); "off" serves the API without running jobs; "inline" does both.
const app =
  config.WORKER_MODE === "only"
    ? Fastify({ logger: loggerOptions(config), genReqId: requestId, requestTimeout: 30000 })
    : await buildApp(db, config);
if (config.WORKER_MODE === "only") registerHealthRoutes(app, db, config);
const stopWorker = config.WORKER_MODE === "off" ? null : startWorker(db, config);

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  await stopWorker?.();
  await app.close();
  await db.$disconnect();
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
// A larger accept backlog absorbs a whole class connecting in the same instant (default 511).
await app.listen({ host: "0.0.0.0", port: config.PORT, backlog: 4096 });
app.log.info({ workerMode: config.WORKER_MODE, workerConcurrency: config.WORKER_CONCURRENCY }, "Portal started");
