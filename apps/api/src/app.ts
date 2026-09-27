import { Hono } from "hono";
import { insightsRoutes } from "./modules/insights/routes.js";
import { telemetryRoutes } from "./modules/telemetry/routes.js";
import { businessRoutes } from "./routes/business.js";
import { workerRoutes } from "./routes/worker.js";
import type { AppEnv } from "./types.js";

export const app = new Hono<AppEnv>();

app.get("/health", (context) => {
  return context.json({ status: "ok", service: "paw-time-api" });
});

app.route("/v1/worker", workerRoutes);
app.route("/v1/business", businessRoutes);
app.route("/v1/telemetry", telemetryRoutes);
app.route("/v1/insights", insightsRoutes);

app.notFound((context) => context.json({ error: "not_found" }, 404));

app.onError((error, context) => {
  if (error instanceof SyntaxError) {
    return context.json({ error: "invalid_request", message: "JSONを読み取れません。" }, 400);
  }
  console.error(error);
  return context.json({ error: "internal_error" }, 500);
});
