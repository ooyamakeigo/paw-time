import assert from "node:assert/strict";
import test from "node:test";
import { app } from "../src/app.js";
import { MemoryStore } from "../src/infrastructure/memory-store.js";
import { createSeed } from "../src/infrastructure/seed.js";

const ORGANIZATION_ID = "org-komorebi";
const ACTOR_ID = "member-demo";
const HOUR = 60 * 60 * 1000;

const businessHeaders = {
  "content-type": "application/json",
  "x-organization-id": ORGANIZATION_ID,
  "x-actor-id": ACTOR_ID,
};

type Json = Record<string, unknown>;

async function call(method: string, path: string, body?: unknown): Promise<{ status: number; body: Json }> {
  const response = await app.request(path, {
    method,
    headers: businessHeaders,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: (await response.json()) as Json };
}

async function hireFor(startsAt: string, endsAt: string, workerId: string, hourlyWage = 1200): Promise<string> {
  const created = await call("POST", "/v1/business/jobs", {
    storeId: "store-komorebi",
    title: "勤怠テスト",
    description: "",
    role: "hall",
    hourlyWage,
    startsAt,
    endsAt,
    capacity: 1,
    status: "published",
  });
  const jobId = (created.body.data as { id: string }).id;
  const applied = await app.request("/v1/worker/applications", {
    method: "POST",
    headers: { "content-type": "application/json", "x-user-id": workerId },
    body: JSON.stringify({ jobPostingId: jobId, workerDisplayName: workerId }),
  });
  const applicationId = ((await applied.json()) as { data: { id: string } }).data.id;
  await call("POST", `/v1/business/applications/${applicationId}/decision`, { decision: "selected" });
  const shifts = await call("GET", "/v1/business/shifts");
  const shift = (shifts.body.data as Array<{ id: string; applicationId: string }>).find(
    (candidate) => candidate.applicationId === applicationId,
  );
  assert.ok(shift);
  return shift.id;
}

async function punch(shiftId: string, kind: string, recordedAt: string, requestId: string) {
  return call("POST", `/v1/business/shifts/${shiftId}/attendance`, { kind, recordedAt, clientRequestId: requestId });
}

async function summary(shiftId: string) {
  const response = await call("GET", `/v1/business/shifts/${shiftId}/attendance-summary`);
  return response.body.data as Record<string, number | string | boolean | null>;
}

test("breaks sit between check-in and check-out and reduce worked time", async () => {
  const shiftId = await hireFor("2026-11-02T18:00:00+09:00", "2026-11-02T23:30:00+09:00", "worker-break-test");

  assert.equal((await punch(shiftId, "break_start", "2026-11-02T17:00:00+09:00", "b-0")).status, 409);
  assert.equal((await punch(shiftId, "check_in", "2026-11-02T18:00:00+09:00", "b-1")).status, 201);
  assert.equal((await punch(shiftId, "break_end", "2026-11-02T19:00:00+09:00", "b-2")).status, 409);
  assert.equal((await punch(shiftId, "break_start", "2026-11-02T20:00:00+09:00", "b-3")).status, 201);
  assert.equal((await summary(shiftId)).onBreak, true);
  assert.equal((await punch(shiftId, "check_out", "2026-11-02T20:10:00+09:00", "b-4")).status, 409);
  assert.equal((await punch(shiftId, "break_end", "2026-11-02T19:59:00+09:00", "b-5")).status, 400);
  assert.equal((await punch(shiftId, "break_end", "2026-11-02T20:30:00+09:00", "b-6")).status, 201);
  assert.equal((await punch(shiftId, "check_out", "2026-11-02T23:30:00+09:00", "b-7")).status, 201);

  const result = await summary(shiftId);
  assert.equal(result.breakMinutes, 30);
  assert.equal(result.workedMinutes, 300);
  assert.equal(result.nightMinutes, 90);
  assert.equal(result.overtimeMinutes, 0);
  assert.equal(result.breakShortfallMinutes, 0);
  assert.equal(result.scheduledMinutes, 330);
  // 1200 × 300/60 = 6000, plus 25% on 90 night minutes = 450
  assert.equal(result.estimatedPay, 6450);
  assert.equal(result.onBreak, false);
});

test("a long shift without a break owes one, and time beyond 8 hours earns a premium", async () => {
  const shiftId = await hireFor("2026-11-03T10:00:00+09:00", "2026-11-03T18:30:00+09:00", "worker-long-test", 1000);
  await punch(shiftId, "check_in", "2026-11-03T10:00:00+09:00", "l-1");
  await punch(shiftId, "check_out", "2026-11-03T19:00:00+09:00", "l-2");
  const result = await summary(shiftId);
  assert.equal(result.workedMinutes, 540);
  assert.equal(result.overtimeMinutes, 30);
  assert.equal(result.breakShortfallMinutes, 60);
  // 1000 × 9h = 9000, plus 25% on the hour beyond 8h = 250
  assert.equal(result.estimatedPay, 9250);
});

test("a correction replaces the punch time but keeps the original on record", async () => {
  const shiftId = await hireFor("2026-11-04T10:00:00+09:00", "2026-11-04T15:00:00+09:00", "worker-correct-test");
  const checkIn = await punch(shiftId, "check_in", "2026-11-04T10:12:00+09:00", "c-1");
  const checkInId = (checkIn.body.data as { id: string }).id;
  await punch(shiftId, "check_out", "2026-11-04T15:00:00+09:00", "c-2");
  assert.equal((await summary(shiftId)).punctuality, "late");

  const tooLate = await call("POST", `/v1/business/shifts/${shiftId}/attendance/corrections`, {
    eventId: checkInId,
    recordedAt: "2026-11-04T15:30:00+09:00",
    reason: "順序が崩れる",
    clientRequestId: "c-3",
  });
  assert.equal(tooLate.status, 400);
  assert.equal(tooLate.body.error, "invalid_time_range");

  const corrected = await call("POST", `/v1/business/shifts/${shiftId}/attendance/corrections`, {
    eventId: checkInId,
    recordedAt: "2026-11-04T09:58:00+09:00",
    reason: "レジの前で打刻が遅れた",
    clientRequestId: "c-4",
  });
  assert.equal(corrected.status, 201);
  assert.equal((corrected.body.data as { correctionOfEventId: string }).correctionOfEventId, checkInId);

  const result = await summary(shiftId);
  assert.equal(result.punctuality, "on_time");
  assert.equal(result.actualCheckInAt, "2026-11-04T09:58:00+09:00");
  assert.equal(result.correctionCount, 1);

  const events = await call("GET", `/v1/business/shifts/${shiftId}/attendance`);
  const kinds = (events.body.data as Array<{ kind: string; note: string | null }>).map((event) => [event.kind, event.note]);
  assert.deepEqual(kinds, [
    ["check_in", "レジの前で打刻が遅れた"],
    ["check_in", null],
    ["check_out", null],
  ]);
});

test("worker histories summarize what the organization has seen of each worker", () => {
  const now = new Date("2026-09-27T00:00:00Z");
  const store = new MemoryStore({ now: () => now, seed: createSeed(now) });
  const histories = store.listWorkerHistories(ORGANIZATION_ID);
  const byId = new Map(histories.map((history) => [history.workerId, history]));

  const haruto = byId.get("worker-demo-haruto");
  assert.ok(haruto);
  assert.equal(haruto.displayName, "はると");
  assert.equal(haruto.completedShifts, 2);
  assert.equal(haruto.onTimeShifts, 2);
  assert.equal(haruto.averageRating, 4);
  assert.equal(haruto.recentShifts[0]?.jobTitle, "ランチのホール");
  assert.equal(haruto.recentShifts[0]?.workedMinutes, 4 * 60 + 8 - 20);

  const tsumugi = byId.get("worker-demo-tsumugi");
  assert.ok(tsumugi);
  assert.equal(tsumugi.noShows, 1);
  assert.equal(tsumugi.completedShifts, 0);

  const mika = byId.get("worker-demo-mika");
  assert.ok(mika);
  assert.equal(mika.recentShifts.length, 0);
  assert.equal(mika.lastWorkedAt, null);
});

test("missed punches are flagged once the grace period passes", () => {
  let now = new Date("2026-09-27T00:00:00Z");
  const store = new MemoryStore({ now: () => now, seed: createSeed(new Date("2026-09-27T00:00:00Z")) });
  const missing = () =>
    Object.fromEntries(
      store.listAttendanceSummaries(ORGANIZATION_ID).map((entry) => [entry.shiftId, entry.missingPunch]),
    );
  assert.equal(missing()["shift-demo-rin"], "none");
  assert.equal(missing()["shift-demo-yu"], "none");
  now = new Date(now.getTime() + 3 * HOUR);
  assert.equal(missing()["shift-demo-rin"], "check_in");
  assert.equal(missing()["shift-demo-yu"], "check_out");
});

test("the organization can list every punch at once", async () => {
  const response = await call("GET", "/v1/business/attendance-events");
  assert.equal(response.status, 200);
  const events = response.body.data as Array<{ organizationId: string; recordedAt: string; kind: string }>;
  assert.ok(events.length > 0);
  assert.ok(events.every((event) => event.organizationId === ORGANIZATION_ID));
  const times = events.map((event) => Date.parse(event.recordedAt));
  assert.deepEqual(times, [...times].sort((left, right) => left - right));
  assert.ok(events.some((event) => event.kind === "break_start"));
});
