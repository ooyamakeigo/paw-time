import assert from "node:assert/strict";
import test from "node:test";
import { app } from "../src/app.js";

const businessHeaders = {
  "content-type": "application/json",
  "x-organization-id": "org-komorebi",
  "x-actor-id": "member-demo",
};

const otherOrganizationHeaders = {
  ...businessHeaders,
  "x-organization-id": "org-other",
};

type Json = Record<string, unknown>;

async function call(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = businessHeaders,
): Promise<{ status: number; body: Json }> {
  const response = await app.request(path, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: (await response.json()) as Json };
}

async function experience(): Promise<number> {
  const { body } = await call("GET", "/v1/business/world");
  return (body.data as { experience: number }).experience;
}

function jobInput(overrides: Json = {}): Json {
  return {
    storeId: "store-komorebi",
    title: "テスト求人",
    description: "テスト",
    role: "hall",
    hourlyWage: 1200,
    startsAt: "2026-11-01T10:00:00+09:00",
    endsAt: "2026-11-01T15:00:00+09:00",
    capacity: 1,
    status: "draft",
    ...overrides,
  };
}

async function hire(jobId: string, workerId: string): Promise<string> {
  const applied = await call(
    "POST",
    "/v1/worker/applications",
    { jobPostingId: jobId, workerDisplayName: workerId },
    { "content-type": "application/json", "x-user-id": workerId },
  );
  assert.equal(applied.status, 201);
  const applicationId = (applied.body.data as { id: string }).id;
  const decided = await call("POST", `/v1/business/applications/${applicationId}/decision`, {
    decision: "selected",
  });
  assert.equal(decided.status, 200);
  const shifts = await call("GET", "/v1/business/shifts");
  const shift = (shifts.body.data as Array<{ id: string; applicationId: string }>).find(
    (candidate) => candidate.applicationId === applicationId,
  );
  assert.ok(shift);
  return shift.id;
}

test("stores are listed per organization", async () => {
  const own = await call("GET", "/v1/business/stores");
  assert.equal((own.body.data as unknown[]).length, 2);
  const other = await call("GET", "/v1/business/stores", undefined, otherOrganizationHeaders);
  assert.deepEqual(other.body.data, []);
});

test("jobs move from draft to published to closed once", async () => {
  const created = await call("POST", "/v1/business/jobs", jobInput());
  assert.equal(created.status, 201);
  const jobId = (created.body.data as { id: string }).id;

  const before = await experience();
  const published = await call("POST", `/v1/business/jobs/${jobId}/publish`);
  assert.equal(published.status, 200);
  assert.equal((published.body.data as { status: string }).status, "published");
  assert.equal(await experience(), before + 5);

  const republished = await call("POST", `/v1/business/jobs/${jobId}/publish`);
  assert.equal(republished.status, 409);
  assert.equal(republished.body.error, "invalid_transition");

  const closed = await call("POST", `/v1/business/jobs/${jobId}/close`);
  assert.equal(closed.status, 200);
  assert.equal((await call("POST", `/v1/business/jobs/${jobId}/close`)).status, 409);
  assert.equal(await experience(), before + 5);
});

test("job creation validates store, status and time range", async () => {
  const closed = await call("POST", "/v1/business/jobs", jobInput({ status: "closed" }));
  assert.equal(closed.status, 409);

  const unknownStore = await call("POST", "/v1/business/jobs", jobInput({ storeId: "store-elsewhere" }));
  assert.equal(unknownStore.status, 400);
  assert.equal(unknownStore.body.error, "store_not_found");

  const reversed = await call(
    "POST",
    "/v1/business/jobs",
    jobInput({ endsAt: "2026-11-01T09:00:00+09:00" }),
  );
  assert.equal(reversed.status, 400);
  assert.equal(reversed.body.error, "invalid_time_range");
});

test("selection stops at the job capacity", async () => {
  const created = await call("POST", "/v1/business/jobs", jobInput({ status: "published" }));
  const jobId = (created.body.data as { id: string }).id;
  await hire(jobId, "worker-capacity-first");

  const applied = await call(
    "POST",
    "/v1/worker/applications",
    { jobPostingId: jobId, workerDisplayName: "二人目" },
    { "content-type": "application/json", "x-user-id": "worker-capacity-second" },
  );
  const applicationId = (applied.body.data as { id: string }).id;
  const decided = await call("POST", `/v1/business/applications/${applicationId}/decision`, {
    decision: "selected",
  });
  assert.equal(decided.status, 409);
  assert.equal(decided.body.error, "capacity_reached");

  const rejected = await call("POST", `/v1/business/applications/${applicationId}/decision`, {
    decision: "rejected",
    note: "定員に達したため",
  });
  assert.equal(rejected.status, 200);
  assert.equal((rejected.body.data as { decisionNote: string }).decisionNote, "定員に達したため");
});

test("a shift must be confirmed before it can be evaluated", async () => {
  const created = await call("POST", "/v1/business/jobs", jobInput({ status: "published" }));
  const jobId = (created.body.data as { id: string }).id;
  const workerId = "worker-evaluation-test";
  const shiftId = await hire(jobId, workerId);
  const evaluation = {
    shiftId,
    subjectType: "worker",
    subjectId: workerId,
    rating: 5,
    tags: ["on_time"],
  };

  const checkIn = await call("POST", `/v1/business/shifts/${shiftId}/attendance`, {
    kind: "check_in",
    recordedAt: "2026-11-01T09:58:00+09:00",
    clientRequestId: "evaluation-test-in",
  });
  assert.equal(checkIn.status, 201);
  assert.equal((await call("POST", "/v1/business/evaluations", evaluation)).status, 409);
  assert.equal((await call("POST", `/v1/business/shifts/${shiftId}/confirm`)).status, 409);

  const early = await call("POST", `/v1/business/shifts/${shiftId}/attendance`, {
    kind: "check_out",
    recordedAt: "2026-11-01T09:00:00+09:00",
    clientRequestId: "evaluation-test-out-early",
  });
  assert.equal(early.status, 400);
  assert.equal(early.body.error, "invalid_time_range");

  const checkOut = await call("POST", `/v1/business/shifts/${shiftId}/attendance`, {
    kind: "check_out",
    recordedAt: "2026-11-01T15:02:00+09:00",
    clientRequestId: "evaluation-test-out",
  });
  assert.equal(checkOut.status, 201);

  const beforeConfirm = await experience();
  const confirmed = await call("POST", `/v1/business/shifts/${shiftId}/confirm`);
  assert.equal(confirmed.status, 200);
  assert.equal((confirmed.body.data as { status: string }).status, "completed");
  assert.equal(await experience(), beforeConfirm + 20);
  assert.equal((await call("POST", `/v1/business/shifts/${shiftId}/confirm`)).status, 409);

  const submitted = await call("POST", "/v1/business/evaluations", evaluation);
  assert.equal(submitted.status, 201);
  const resubmitted = await call("POST", "/v1/business/evaluations", evaluation);
  assert.equal(resubmitted.status, 201);
  assert.equal(
    (resubmitted.body.data as { id: string }).id,
    (submitted.body.data as { id: string }).id,
  );
  assert.equal(await experience(), beforeConfirm + 25);

  const summaries = await call("GET", "/v1/business/attendance-summaries");
  const summary = (summaries.body.data as Array<{ shiftId: string; punctuality: string }>).find(
    (candidate) => candidate.shiftId === shiftId,
  );
  assert.equal(summary?.punctuality, "on_time");

  const evaluations = await call("GET", "/v1/business/evaluations");
  assert.ok(
    (evaluations.body.data as Array<{ shiftId: string }>).some(
      (candidate) => candidate.shiftId === shiftId,
    ),
  );
});

test("other organizations cannot touch this organization's records", async () => {
  const publish = await call(
    "POST",
    "/v1/business/jobs/job-demo-morning/publish",
    undefined,
    otherOrganizationHeaders,
  );
  // Another organization's actor is not a member here, so manager-only routes refuse outright.
  assert.equal(publish.status, 403);

  const confirm = await call(
    "POST",
    "/v1/business/shifts/shift-demo-koharu/confirm",
    undefined,
    otherOrganizationHeaders,
  );
  assert.equal(confirm.status, 403);

  const decide = await call(
    "POST",
    "/v1/business/applications/application-demo-1/decision",
    { decision: "rejected" },
    otherOrganizationHeaders,
  );
  assert.equal(decide.status, 403);

  const summaries = await call(
    "GET",
    "/v1/business/attendance-summaries",
    undefined,
    otherOrganizationHeaders,
  );
  assert.deepEqual(summaries.body.data, []);
});

test("malformed JSON is rejected as a bad request", async () => {
  const response = await app.request("/v1/business/jobs", {
    method: "POST",
    headers: businessHeaders,
    body: "{",
  });
  assert.equal(response.status, 400);
});
