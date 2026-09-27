import type { MiddlewareHandler } from "hono";
import { store } from "../infrastructure/memory-store.js";
import type { AppEnv } from "../types.js";

/**
 * Development-only context: the organization and actor come from headers.
 * Production resolves both from the authentication token instead. The actor's
 * role comes from the organization's member list; unknown actors are staff.
 */
export const requireBusinessContext: MiddlewareHandler<AppEnv> = async (context, next) => {
  const organizationId = context.req.header("x-organization-id");
  const actorId = context.req.header("x-actor-id");

  if (!organizationId || !actorId) {
    return context.json(
      {
        error: "unauthorized",
        message: "x-organization-id と x-actor-id が必要です。",
      },
      401,
    );
  }

  context.set("organizationId", organizationId);
  context.set("actorId", actorId);
  context.set("role", store.roleOf(organizationId, actorId));
  await next();
};

/** Managers only: hiring decisions, money, locks and settings. */
export const requireManager: MiddlewareHandler<AppEnv> = async (context, next) => {
  if (context.get("role") !== "manager") {
    return context.json({ error: "forbidden", message: "店長の権限が必要です。" }, 403);
  }
  await next();
};
