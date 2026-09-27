import {
  CreateApplicationInputSchema,
  CreateShopFeedbackInputSchema,
  CreateWorkerActivityInputSchema,
  RecordAttendanceInputSchema,
  ReplyLetterInputSchema,
  RespondInvitationInputSchema,
} from "@paw-time/api-contracts";
import { Hono, type Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { store, type Result, type StoreError } from "../infrastructure/memory-store.js";

type WorkerEnv = { Variables: { workerId: string } };

export const workerRoutes = new Hono<WorkerEnv>();

const errorStatus: Record<StoreError, ContentfulStatusCode> = {
  not_found: 404,
  invalid_transition: 409,
  capacity_reached: 409,
  invalid_time_range: 400,
  store_not_found: 400,
  empty_letter: 400,
  forbidden: 403,
  period_closed: 409,
};

function respond<T>(context: Context<WorkerEnv>, result: Result<T>, successStatus: ContentfulStatusCode = 200) {
  if (!result.ok) return context.json({ error: result.error }, errorStatus[result.error]);
  return context.json({ data: result.value }, successStatus);
}

workerRoutes.get("/jobs", (context) => {
  return context.json({ data: store.listPublishedJobs() });
});

/** Development-only identity: the worker comes from a header. */
workerRoutes.use("*", async (context, next) => {
  if (context.req.method === "GET" && context.req.path.endsWith("/jobs")) return next();
  const workerId = context.req.header("x-user-id");
  if (!workerId) return context.json({ error: "unauthorized" }, 401);
  context.set("workerId", workerId);
  await next();
});

workerRoutes.post("/applications", async (context) => {
  const parsed = CreateApplicationInputSchema.safeParse(await context.req.json());
  if (!parsed.success) {
    return context.json({ error: "invalid_request", issues: parsed.error.issues }, 400);
  }
  const application = store.applyForJob(context.get("workerId"), parsed.data);
  if (!application) return context.json({ error: "job_not_found" }, 404);
  return context.json({ data: application }, 201);
});

workerRoutes.post("/applications/:applicationId/withdraw", (context) => {
  return respond(context, store.withdrawApplication(context.get("workerId"), context.req.param("applicationId")));
});

workerRoutes.get("/shifts", (context) => {
  return context.json({ data: store.listWorkerShifts(context.get("workerId")) });
});

/** The worker's own punch, from the worker app or the shop's tablet. */
workerRoutes.post("/shifts/:shiftId/attendance", async (context) => {
  const parsed = RecordAttendanceInputSchema.safeParse(await context.req.json());
  if (!parsed.success) {
    return context.json({ error: "invalid_request", issues: parsed.error.issues }, 400);
  }
  return respond(
    context,
    store.recordWorkerAttendance(context.get("workerId"), context.req.param("shiftId"), parsed.data),
    201,
  );
});

workerRoutes.get("/invitations", (context) => {
  return context.json({ data: store.listWorkerInvitations(context.get("workerId")) });
});

workerRoutes.post("/invitations/:invitationId/respond", async (context) => {
  const parsed = RespondInvitationInputSchema.safeParse(await context.req.json());
  if (!parsed.success) {
    return context.json({ error: "invalid_request", issues: parsed.error.issues }, 400);
  }
  return respond(
    context,
    store.respondToInvitation(context.get("workerId"), context.req.param("invitationId"), parsed.data.response),
  );
});

workerRoutes.get("/letters", (context) => {
  return context.json({ data: store.listWorkerLetters(context.get("workerId")) });
});

workerRoutes.post("/letters/:letterId/reply", async (context) => {
  const parsed = ReplyLetterInputSchema.safeParse(await context.req.json());
  if (!parsed.success) {
    return context.json({ error: "invalid_request", issues: parsed.error.issues }, 400);
  }
  return respond(
    context,
    store.replyToLetter(context.get("workerId"), context.req.param("letterId"), parsed.data.replyStamp),
  );
});

/** Anonymous answers about the shop; the shop only ever sees a summary of five or more. */
workerRoutes.post("/shop-feedback", async (context) => {
  const parsed = CreateShopFeedbackInputSchema.safeParse(await context.req.json());
  if (!parsed.success) {
    return context.json({ error: "invalid_request", issues: parsed.error.issues }, 400);
  }
  return respond(context, store.createShopFeedback(context.get("workerId"), parsed.data), 201);
});

workerRoutes.post("/activity", async (context) => {
  const parsed = CreateWorkerActivityInputSchema.safeParse(await context.req.json());
  if (!parsed.success) {
    return context.json({ error: "invalid_request", issues: parsed.error.issues }, 400);
  }
  return context.json({ data: store.recordWorkerActivity(context.get("workerId"), parsed.data) }, 201);
});
