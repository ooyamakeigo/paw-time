import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { app } from "../src/app.js";
import { MemoryStore } from "../src/infrastructure/memory-store.js";
import { attachPersistence, loadSnapshot, saveSnapshot } from "../src/infrastructure/persistence.js";
import { createSeed } from "../src/infrastructure/seed.js";

const ORGANIZATION_ID = "org-komorebi";
const MANAGER_ID = "member-demo";
const STAFF_ID = "member-staff";
const HOUR = 60 * 60 * 1000;

type Json = Record<string, unknown>;

async function call(method: string, path: string, body?: unknown, actorId = MANAGER_ID, extra: Record<string, string> = {}) {
  const response = await app.request(path, {
    method,
    headers: {
      "content-type": "application/json",
      "x-organization-id": ORGANIZATION_ID,
      "x-actor-id": actorId,
      ...extra,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: (await response.json()) as Json };
}

async function worker(method: string, path: string, workerId: string, body?: unknown) {
  const response = await app.request(path, {
    method,
    headers: { "content-type": "application/json", "x-user-id": workerId },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: (await response.json()) as Json };
}

function storeAt(start: string) {
  let current = new Date(start);
  const store = new MemoryStore({ now: () => current, seed: createSeed(current) });
  return {
    store,
    advance(milliseconds: number) {
      current = new Date(current.getTime() + milliseconds);
    },
  };
}

test("staff can punch but cannot decide, confirm, correct or see money reports", async () => {
  const me = await call("GET", "/v1/business/me", undefined, STAFF_ID);
  assert.equal((me.body.data as { member: { role: string } }).member.role, "staff");
  assert.equal((await call("POST", "/v1/business/applications/application-demo-1/decision", { decision: "rejected" }, STAFF_ID)).status, 403);
  assert.equal((await call("POST", "/v1/business/shifts/shift-demo-koharu/confirm", undefined, STAFF_ID)).status, 403);
  assert.equal((await call("GET", "/v1/business/insights", undefined, STAFF_ID)).status, 403);
  assert.equal((await call("GET", "/v1/business/audit-logs", undefined, STAFF_ID)).status, 403);
  const punch = await call(
    "POST",
    "/v1/business/shifts/shift-demo-rin/attendance",
    { kind: "check_in", recordedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00"), clientRequestId: "staff-punch-1" },
    STAFF_ID,
  );
  assert.equal(punch.status, 201);
  assert.equal((await call("GET", "/v1/business/audit-logs")).status, 200);
});

test("a closed month refuses punches, corrections and confirmations until it is reopened", () => {
  const { store } = storeAt("2026-09-27T00:00:00Z");
  const closed = store.listClosedPeriods(ORGANIZATION_ID);
  assert.equal(closed.length, 1);
  assert.equal(closed[0]?.month, "2026-08");

  const events = store.listAttendanceEvents(ORGANIZATION_ID, "shift-demo-nagi-dinner") ?? [];
  const checkIn = events.find((event) => event.kind === "check_in");
  assert.ok(checkIn);
  const blocked = store.correctAttendance(ORGANIZATION_ID, "shift-demo-nagi-dinner", MANAGER_ID, {
    eventId: checkIn.id,
    recordedAt: checkIn.recordedAt,
    reason: "test",
    clientRequestId: "closed-1",
  });
  assert.deepEqual(blocked, { ok: false, error: "period_closed" });

  const future = store.closePeriod(ORGANIZATION_ID, MANAGER_ID, { storeId: "store-komorebi", month: "2026-12" });
  assert.deepEqual(future, { ok: false, error: "invalid_time_range" });

  const reopened = store.reopenPeriod(ORGANIZATION_ID, MANAGER_ID, closed[0]?.id ?? "");
  assert.ok(reopened.ok);
  const allowed = store.correctAttendance(ORGANIZATION_ID, "shift-demo-nagi-dinner", MANAGER_ID, {
    eventId: checkIn.id,
    recordedAt: checkIn.recordedAt,
    reason: "test",
    clientRequestId: "closed-2",
  });
  assert.ok(allowed.ok);

  const thisMonth = store.closePeriod(ORGANIZATION_ID, MANAGER_ID, { storeId: "store-komorebi", month: "2026-09" });
  assert.ok(thisMonth.ok);
  assert.deepEqual(store.confirmShift(ORGANIZATION_ID, MANAGER_ID, "shift-demo-koharu"), { ok: false, error: "period_closed" });
});

test("a no-show can be turned into an urgent job, and an invited past worker fills it", () => {
  const { store, advance } = storeAt("2026-09-27T03:00:00Z");
  // A shift from last week is too late to refill.
  assert.deepEqual(store.createUrgentJob(ORGANIZATION_ID, MANAGER_ID, "shift-demo-tsumugi-lunch"), { ok: false, error: "invalid_time_range" });
  advance(2.5 * HOUR);
  assert.ok(store.markNoShow(ORGANIZATION_ID, MANAGER_ID, "shift-demo-rin").ok);
  const urgent = store.createUrgentJob(ORGANIZATION_ID, MANAGER_ID, "shift-demo-rin");
  assert.ok(urgent.ok);
  assert.equal(urgent.value.status, "published");
  assert.ok(urgent.value.urgent);
  assert.equal(urgent.value.capacity, 1);
  assert.ok(urgent.value.title.startsWith("【急募】"));
  // Idempotent per shift.
  const again = store.createUrgentJob(ORGANIZATION_ID, MANAGER_ID, "shift-demo-rin");
  assert.ok(again.ok && again.value.id === urgent.value.id);

  const stranger = store.createInvitation(ORGANIZATION_ID, MANAGER_ID, { jobPostingId: urgent.value.id, workerId: "worker-nobody" });
  assert.deepEqual(stranger, { ok: false, error: "not_found" });
  const invited = store.createInvitation(ORGANIZATION_ID, MANAGER_ID, { jobPostingId: urgent.value.id, workerId: "worker-demo-nagi" });
  assert.ok(invited.ok);
  assert.equal(invited.value.workerDisplayName, "なぎ");
  assert.equal(store.listWorkerInvitations("worker-demo-nagi").length, 1);

  const accepted = store.respondToInvitation("worker-demo-nagi", invited.value.id, "accepted");
  assert.ok(accepted.ok);
  const shift = store.listWorkerShifts("worker-demo-nagi").find((candidate) => candidate.jobPostingId === urgent.value.id);
  assert.ok(shift);
  assert.equal(shift.status, "scheduled");
  const second = store.createInvitation(ORGANIZATION_ID, MANAGER_ID, { jobPostingId: urgent.value.id, workerId: "worker-demo-kei" });
  assert.ok(second.ok);
  assert.deepEqual(store.respondToInvitation("worker-demo-kei", second.value.id, "accepted"), { ok: false, error: "capacity_reached" });
});

test("workers punch their own shifts and only their own", async () => {
  const ok = await worker("POST", "/v1/worker/shifts/shift-demo-rin/attendance", "worker-demo-rin", {
    kind: "check_in",
    recordedAt: new Date(Date.now() + HOUR).toISOString().replace(/\.\d{3}Z$/, "+00:00"),
    clientRequestId: "worker-punch-1",
  });
  assert.ok(ok.status === 201 || ok.status === 409, `status ${ok.status}`);
  const other = await worker("POST", "/v1/worker/shifts/shift-demo-yu/attendance", "worker-demo-rin", {
    kind: "check_out",
    recordedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00"),
    clientRequestId: "worker-punch-2",
  });
  assert.equal(other.status, 404);
});

test("shop reviews grow landmarks by tag votes, shown only from five workers on", () => {
  const { store } = storeAt("2026-09-27T00:00:00Z");
  const main = store.shopFeedbackSummary(ORGANIZATION_ID, "store-komorebi");
  assert.ok(main);
  assert.equal(main.responses, 37);
  assert.equal(main.published, true);
  assert.equal(main.tags.on_time, 23);
  assert.equal(main.tags.fair, 3);
  const byId = Object.fromEntries(main.landmarks.map((landmark) => [landmark.id, landmark]));
  assert.equal(byId.clock_tower?.level, 3);
  assert.equal(byId.guide_post?.level, 2);
  assert.equal(byId.fair_fountain?.level, 1);
  assert.equal(main.stage, 2);
  assert.ok((main.averageStars ?? 0) > 4);

  const annex = store.shopFeedbackSummary(ORGANIZATION_ID, "store-komorebi-annex");
  assert.ok(annex);
  assert.equal(annex.responses, 2);
  assert.equal(annex.published, false);
  assert.ok(annex.landmarks.every((landmark) => landmark.level === 0 && !landmark.sprout));
  assert.equal(annex.tags.friendly, 0);

  const before = store.getWorld("organization", ORGANIZATION_ID).experience;
  const notFinished = store.createShopFeedback("worker-demo-rin", { shiftId: "shift-demo-rin", stars: 5, tags: ["again"] });
  assert.deepEqual(notFinished, { ok: false, error: "invalid_transition" });
  const answered = store.createShopFeedback("worker-demo-yui", { shiftId: "shift-demo-yui-register", stars: 4, tags: ["fair", "fair", "again"] });
  assert.ok(answered.ok);
  assert.deepEqual(answered.value.tags, ["fair", "again"]);
  assert.equal(store.getWorld("organization", ORGANIZATION_ID).experience, before + 5);
  assert.equal(store.shopFeedbackSummary(ORGANIZATION_ID, "store-komorebi")?.tags.fair, 4);
  assert.ok(store.listRewards("organization", ORGANIZATION_ID).some((grant) => grant.rewardCode === "shop_reviewed"));
});

test("a shop can change its island's looks but nothing else", () => {
  const { store } = storeAt("2026-09-27T00:00:00Z");
  const updated = store.updateStore(ORGANIZATION_ID, MANAGER_ID, "store-komorebi", {
    logoUrl: "data:image/svg+xml;base64,PHN2Zy8+",
    signColor: "#c9454a",
    values: "  にぎやかな夜も、おたがいさまで。 ",
  });
  assert.ok(updated.ok);
  assert.equal(updated.value.signColor, "#c9454a");
  assert.equal(updated.value.accentColor, "#fdf7ee");
  assert.equal(updated.value.values, "にぎやかな夜も、おたがいさまで。");
  assert.deepEqual(store.updateStore(ORGANIZATION_ID, MANAGER_ID, "store-nowhere", { values: "x" }), { ok: false, error: "store_not_found" });
  assert.ok(store.listAuditLogs(ORGANIZATION_ID).some((entry) => entry.action === "store.updated"));
});

test("letters get a stamp back, never text", () => {
  const { store } = storeAt("2026-09-27T00:00:00Z");
  const letter = store.listWorkerLetters("worker-demo-aoi")[0];
  assert.ok(letter);
  assert.equal(letter.replyStamp, "thanks");
  const replied = store.replyToLetter("worker-demo-aoi", letter.id, "fun");
  assert.ok(replied.ok && replied.value.replyStamp === "fun");
  assert.deepEqual(store.replyToLetter("worker-demo-haruto", letter.id, "fun"), { ok: false, error: "not_found" });
});

test("withdrawing a hired application cancels the shift and counts as a last-minute cancellation", () => {
  const { store } = storeAt("2026-09-27T00:00:00Z");
  const withdrawn = store.withdrawApplication("worker-demo-rin", "application-demo-rin");
  assert.ok(withdrawn.ok);
  assert.equal(withdrawn.value.status, "withdrawn");
  assert.equal(store.listWorkerShifts("worker-demo-rin")[0]?.status, "cancelled");
  const report = store.insights(ORGANIZATION_ID, null, 30);
  assert.ok((report.lastMinuteCancelRate ?? 0) > 0);
  // Nothing else can happen to a cancelled shift.
  assert.deepEqual(store.markNoShow(ORGANIZATION_ID, MANAGER_ID, "shift-demo-rin"), { ok: false, error: "invalid_transition" });
});

test("the signals report covers who came back, who opened the app, and how jobs filled", () => {
  const { store } = storeAt("2026-09-27T00:00:00Z");
  const report = store.insights(ORGANIZATION_ID, null, 30);
  assert.ok(report.completedShifts >= 5);
  assert.ok(report.distinctWorkers >= 4);
  assert.ok((report.nextDayOpenRate ?? 0) > 0.5);
  assert.ok((report.returnRate ?? 0) > 0);
  assert.equal(report.islandVisits, 3);
  assert.ok(report.jobs.length > 0);
  const filled = report.jobs.find((job) => job.jobId === "job-demo-register");
  assert.ok(filled);
  assert.equal(filled.selected, 1);
  assert.ok((filled.hoursToFill ?? 0) > 0);
  const single = store.insights(ORGANIZATION_ID, "store-komorebi-annex", 30);
  assert.equal(single.completedShifts, 0);
  assert.equal(single.jobs.length, 1);
});

test("a worker's second confirmed shift earns the shop the returning-worker reward", () => {
  const { store } = storeAt("2026-09-27T05:00:00Z");
  const decided = store.decideApplication(ORGANIZATION_ID, MANAGER_ID, "application-demo-haruto", { decision: "selected" });
  assert.ok(decided.ok);
  const shift = store.listWorkerShifts("worker-demo-haruto").find((candidate) => candidate.jobPostingId === "job-demo-hall");
  assert.ok(shift);
  assert.ok(store.recordAttendance(ORGANIZATION_ID, shift.id, MANAGER_ID, "employer", {
    kind: "check_in", recordedAt: shift.scheduledStartAt, clientRequestId: "ret-1",
  }).ok);
  assert.ok(store.recordAttendance(ORGANIZATION_ID, shift.id, MANAGER_ID, "employer", {
    kind: "check_out", recordedAt: shift.scheduledEndAt, clientRequestId: "ret-2",
  }).ok);
  const before = store.getWorld("organization", ORGANIZATION_ID).experience;
  assert.ok(store.confirmShift(ORGANIZATION_ID, MANAGER_ID, shift.id).ok);
  assert.equal(store.getWorld("organization", ORGANIZATION_ID).experience, before + 20 + 10);
});

test("store settings change how attendance is summarized", () => {
  const { store } = storeAt("2026-09-27T00:00:00Z");
  const before = store.getAttendanceSummary(ORGANIZATION_ID, "shift-demo-koharu");
  assert.ok(before);
  const updated = store.updateStoreSettings(ORGANIZATION_ID, MANAGER_ID, "store-komorebi", {
    breakRules: [{ workedOverMinutes: 4 * 60, requiredBreakMinutes: 60 }],
    overtimePremiumRate: 0.25,
    nightPremiumRate: 0.5,
    roundingMinutes: 15,
    closingDay: 20,
  });
  assert.ok(updated.ok);
  const after = store.getAttendanceSummary(ORGANIZATION_ID, "shift-demo-koharu");
  assert.ok(after);
  assert.equal(after.workedMinutes % 15, 0);
  assert.ok(after.workedMinutes <= before.workedMinutes);
  assert.equal(after.breakShortfallMinutes, 30);
  assert.deepEqual(
    store.updateStoreSettings(ORGANIZATION_ID, MANAGER_ID, "store-nowhere", { ...updated.value }),
    { ok: false, error: "store_not_found" },
  );
});

test("a data file saved by an older build still loads: missing collections come from the seed or stay empty", () => {
  const { store } = storeAt("2026-09-27T00:00:00Z");
  const snapshot = structuredClone(store.toSnapshot()) as unknown as Record<string, unknown>;
  for (const key of ["letters", "shopFeedback", "invitations", "closedPeriods", "workerActivities", "members", "storeSettings"]) delete snapshot[key];
  const restored = new MemoryStore({ snapshot: snapshot as unknown as ReturnType<MemoryStore["toSnapshot"]> });
  assert.deepEqual(restored.listLetters(ORGANIZATION_ID), []);
  assert.equal(restored.shopFeedbackSummary(ORGANIZATION_ID, "store-komorebi")?.responses, 0);
  assert.equal(restored.roleOf(ORGANIZATION_ID, MANAGER_ID), "manager");
  assert.equal(restored.listOrganizationJobs(ORGANIZATION_ID).length, store.listOrganizationJobs(ORGANIZATION_ID).length);
});

test("a snapshot round-trips through memory and through a file", async () => {
  const { store } = storeAt("2026-09-27T00:00:00Z");
  assert.ok(store.publishJob(ORGANIZATION_ID, MANAGER_ID, "job-demo-morning").ok);
  const snapshot = store.toSnapshot();
  const restored = new MemoryStore({ snapshot: structuredClone(snapshot) });
  assert.equal(restored.listOrganizationJobs(ORGANIZATION_ID).find((job) => job.id === "job-demo-morning")?.status, "published");
  assert.equal(restored.getWorld("organization", ORGANIZATION_ID).experience, store.getWorld("organization", ORGANIZATION_ID).experience);
  assert.equal(restored.listAuditLogs(ORGANIZATION_ID).length, store.listAuditLogs(ORGANIZATION_ID).length);

  const directory = await mkdtemp(join(tmpdir(), "paw-time-"));
  const target = { kind: "file" as const, path: join(directory, "data", "store.json") };
  assert.equal(await loadSnapshot(target), undefined);
  await saveSnapshot(target, snapshot);
  const loaded = await loadSnapshot(target);
  assert.equal(loaded?.jobs.length, snapshot.jobs.length);

  const flush = attachPersistence(store, target);
  assert.ok(store.closeJob(ORGANIZATION_ID, MANAGER_ID, "job-demo-morning").ok);
  await flush();
  const saved = JSON.parse(await readFile(target.path, "utf8")) as { jobs: Array<{ id: string; status: string }> };
  assert.equal(saved.jobs.find((job) => job.id === "job-demo-morning")?.status, "closed");
});
