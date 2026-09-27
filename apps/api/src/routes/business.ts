import {
  ApplicationDecisionInputSchema,
  UpdateStoreInputSchema,
  ClosePeriodInputSchema,
  CorrectAttendanceInputSchema,
  CreateEvaluationInputSchema,
  CreateInvitationInputSchema,
  CreateJobPostingInputSchema,
  CreateLetterInputSchema,
  RecordAttendanceInputSchema,
  UpdateStoreSettingsInputSchema,
} from "@paw-time/api-contracts";
import { Hono, type Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { store, type Result, type StoreError } from "../infrastructure/memory-store.js";
import { requireBusinessContext, requireManager } from "../middleware/business-context.js";
import type { AppEnv } from "../types.js";

export const businessRoutes = new Hono<AppEnv>();

businessRoutes.use("*", requireBusinessContext);

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

function respond<T>(
  context: Context<AppEnv>,
  result: Result<T>,
  successStatus: ContentfulStatusCode = 200,
) {
  if (!result.ok) return context.json({ error: result.error }, errorStatus[result.error]);
  return context.json({ data: result.value }, successStatus);
}

function invalid(context: Context<AppEnv>, issues: unknown) {
  return context.json({ error: "invalid_request", issues }, 400);
}

// ---- who am I, stores, settings ---------------------------------------------

businessRoutes.get("/me", (context) => {
  const organizationId = context.get("organizationId");
  const actorId = context.get("actorId");
  const member = store.findMember(organizationId, actorId) ?? {
    id: actorId,
    organizationId,
    displayName: actorId,
    role: context.get("role"),
  };
  return context.json({
    data: { member, members: store.listMembers(organizationId), stores: store.listStores(organizationId) },
  });
});

businessRoutes.get("/members", (context) => {
  return context.json({ data: store.listMembers(context.get("organizationId")) });
});

businessRoutes.get("/stores", (context) => {
  return context.json({ data: store.listStores(context.get("organizationId")) });
});

/** The island's looks: logo, colors, the one line. Managers only. */
businessRoutes.put("/stores/:storeId", requireManager, async (context) => {
  const parsed = UpdateStoreInputSchema.safeParse(await context.req.json());
  if (!parsed.success) return invalid(context, parsed.error.issues);
  return respond(
    context,
    store.updateStore(context.get("organizationId"), context.get("actorId"), context.req.param("storeId"), parsed.data),
  );
});

businessRoutes.get("/stores/settings", (context) => {
  return context.json({ data: store.listStoreSettings(context.get("organizationId")) });
});

businessRoutes.get("/stores/:storeId/settings", (context) => {
  const settings = store.getStoreSettings(context.get("organizationId"), context.req.param("storeId"));
  if (!settings) return context.json({ error: "not_found" }, 404);
  return context.json({ data: settings });
});

businessRoutes.put("/stores/:storeId/settings", requireManager, async (context) => {
  const parsed = UpdateStoreSettingsInputSchema.safeParse(await context.req.json());
  if (!parsed.success) return invalid(context, parsed.error.issues);
  return respond(
    context,
    store.updateStoreSettings(context.get("organizationId"), context.get("actorId"), context.req.param("storeId"), parsed.data),
  );
});

// ---- jobs -------------------------------------------------------------------

businessRoutes.get("/jobs", (context) => {
  return context.json({ data: store.listOrganizationJobs(context.get("organizationId")) });
});

businessRoutes.post("/jobs", requireManager, async (context) => {
  const parsed = CreateJobPostingInputSchema.safeParse(await context.req.json());
  if (!parsed.success) return invalid(context, parsed.error.issues);
  return respond(
    context,
    store.createJob(context.get("organizationId"), context.get("actorId"), parsed.data),
    201,
  );
});

businessRoutes.post("/jobs/:jobId/publish", requireManager, (context) => {
  return respond(
    context,
    store.publishJob(context.get("organizationId"), context.get("actorId"), context.req.param("jobId")),
  );
});

businessRoutes.post("/jobs/:jobId/close", requireManager, (context) => {
  return respond(
    context,
    store.closeJob(context.get("organizationId"), context.get("actorId"), context.req.param("jobId")),
  );
});

/** Posts an urgent, single-opening copy of the job a no-show or cancellation left open. */
businessRoutes.post("/shifts/:shiftId/urgent-job", requireManager, (context) => {
  return respond(
    context,
    store.createUrgentJob(context.get("organizationId"), context.get("actorId"), context.req.param("shiftId")),
    201,
  );
});

// ---- applications and invitations -------------------------------------------

businessRoutes.get("/applications", (context) => {
  return context.json({ data: store.listApplications(context.get("organizationId")) });
});

businessRoutes.post("/applications/:applicationId/decision", requireManager, async (context) => {
  const parsed = ApplicationDecisionInputSchema.safeParse(await context.req.json());
  if (!parsed.success) return invalid(context, parsed.error.issues);
  return respond(
    context,
    store.decideApplication(
      context.get("organizationId"),
      context.get("actorId"),
      context.req.param("applicationId"),
      parsed.data,
    ),
  );
});

businessRoutes.get("/invitations", (context) => {
  return context.json({ data: store.listInvitations(context.get("organizationId")) });
});

businessRoutes.post("/invitations", requireManager, async (context) => {
  const parsed = CreateInvitationInputSchema.safeParse(await context.req.json());
  if (!parsed.success) return invalid(context, parsed.error.issues);
  return respond(
    context,
    store.createInvitation(context.get("organizationId"), context.get("actorId"), parsed.data),
    201,
  );
});

// ---- shifts and attendance --------------------------------------------------

businessRoutes.get("/shifts", (context) => {
  return context.json({ data: store.listOrganizationShifts(context.get("organizationId")) });
});

businessRoutes.post("/shifts/:shiftId/attendance", async (context) => {
  const parsed = RecordAttendanceInputSchema.safeParse(await context.req.json());
  if (!parsed.success) return invalid(context, parsed.error.issues);
  return respond(
    context,
    store.recordAttendance(
      context.get("organizationId"),
      context.req.param("shiftId"),
      context.get("actorId"),
      "employer",
      parsed.data,
    ),
    201,
  );
});

businessRoutes.get("/attendance-events", (context) => {
  return context.json({ data: store.listOrganizationAttendanceEvents(context.get("organizationId")) });
});

businessRoutes.get("/shifts/:shiftId/attendance", (context) => {
  const events = store.listAttendanceEvents(context.get("organizationId"), context.req.param("shiftId"));
  if (!events) return context.json({ error: "not_found" }, 404);
  return context.json({ data: events });
});

businessRoutes.post("/shifts/:shiftId/attendance/corrections", requireManager, async (context) => {
  const parsed = CorrectAttendanceInputSchema.safeParse(await context.req.json());
  if (!parsed.success) return invalid(context, parsed.error.issues);
  return respond(
    context,
    store.correctAttendance(
      context.get("organizationId"),
      context.req.param("shiftId"),
      context.get("actorId"),
      parsed.data,
    ),
    201,
  );
});

businessRoutes.post("/shifts/:shiftId/confirm", requireManager, (context) => {
  return respond(
    context,
    store.confirmShift(context.get("organizationId"), context.get("actorId"), context.req.param("shiftId")),
  );
});

businessRoutes.post("/shifts/:shiftId/no-show", requireManager, (context) => {
  return respond(
    context,
    store.markNoShow(context.get("organizationId"), context.get("actorId"), context.req.param("shiftId")),
  );
});

businessRoutes.get("/shifts/:shiftId/attendance-summary", (context) => {
  const summary = store.getAttendanceSummary(
    context.get("organizationId"),
    context.req.param("shiftId"),
  );
  if (!summary) return context.json({ error: "not_found" }, 404);
  return context.json({ data: summary });
});

businessRoutes.get("/attendance-summaries", (context) => {
  return context.json({ data: store.listAttendanceSummaries(context.get("organizationId")) });
});

// ---- closed periods ---------------------------------------------------------

businessRoutes.get("/closed-periods", (context) => {
  return context.json({ data: store.listClosedPeriods(context.get("organizationId")) });
});

businessRoutes.post("/closed-periods", requireManager, async (context) => {
  const parsed = ClosePeriodInputSchema.safeParse(await context.req.json());
  if (!parsed.success) return invalid(context, parsed.error.issues);
  return respond(
    context,
    store.closePeriod(context.get("organizationId"), context.get("actorId"), parsed.data),
    201,
  );
});

businessRoutes.delete("/closed-periods/:periodId", requireManager, (context) => {
  return respond(
    context,
    store.reopenPeriod(context.get("organizationId"), context.get("actorId"), context.req.param("periodId")),
  );
});

// ---- evaluations, letters, feedback -----------------------------------------

businessRoutes.get("/evaluations", (context) => {
  return context.json({ data: store.listEvaluations(context.get("organizationId")) });
});

businessRoutes.post("/evaluations", async (context) => {
  const parsed = CreateEvaluationInputSchema.safeParse(await context.req.json());
  if (!parsed.success) return invalid(context, parsed.error.issues);
  return respond(
    context,
    store.createEvaluation(context.get("organizationId"), context.get("actorId"), parsed.data),
    201,
  );
});

businessRoutes.get("/letters", (context) => {
  return context.json({ data: store.listLetters(context.get("organizationId")) });
});

businessRoutes.post("/letters", async (context) => {
  const parsed = CreateLetterInputSchema.safeParse(await context.req.json());
  if (!parsed.success) return invalid(context, parsed.error.issues);
  return respond(
    context,
    store.createLetter(context.get("organizationId"), context.get("actorId"), parsed.data),
    201,
  );
});

/** What workers said about each store, only as a summary and only once five or more answered. */
businessRoutes.get("/shop-feedback/summary", (context) => {
  const organizationId = context.get("organizationId");
  const storeId = context.req.query("storeId");
  if (storeId) {
    const summary = store.shopFeedbackSummary(organizationId, storeId);
    if (!summary) return context.json({ error: "not_found" }, 404);
    return context.json({ data: [summary] });
  }
  return context.json({
    data: store.listStores(organizationId).map((candidate) => store.shopFeedbackSummary(organizationId, candidate.id)),
  });
});

// ---- reports ----------------------------------------------------------------

businessRoutes.get("/insights", requireManager, (context) => {
  const days = Number(context.req.query("days") ?? 30);
  const storeId = context.req.query("storeId") ?? null;
  if (!Number.isInteger(days) || days < 1 || days > 366) return invalid(context, [{ message: "days must be 1–366" }]);
  return context.json({ data: store.insights(context.get("organizationId"), storeId, days) });
});

businessRoutes.get("/audit-logs", requireManager, (context) => {
  return context.json({ data: store.listAuditLogs(context.get("organizationId")) });
});

businessRoutes.get("/workers", (context) => {
  return context.json({ data: store.listWorkerHistories(context.get("organizationId")) });
});

// ---- island -----------------------------------------------------------------

businessRoutes.get("/world", (context) => {
  return context.json({
    data: store.getWorld("organization", context.get("organizationId")),
  });
});

businessRoutes.get("/world/rewards", (context) => {
  return context.json({
    data: store.listRewards("organization", context.get("organizationId")),
  });
});
