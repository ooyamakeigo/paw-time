import assert from "node:assert/strict";
import test from "node:test";
import { MemoryStore } from "../src/infrastructure/memory-store.js";
import { createSeed } from "../src/infrastructure/seed.js";

const ORGANIZATION_ID = "org-komorebi";
const ACTOR_ID = "member-demo";
const HOUR = 60 * 60 * 1000;

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

function rewardCodes(store: MemoryStore): string[] {
  return store.listRewards("organization", ORGANIZATION_ID).map((grant) => grant.rewardCode);
}

test("seeded rewards build the house experience from the catalog", () => {
  const { store } = storeAt("2026-09-27T00:00:00Z");
  const world = store.getWorld("organization", ORGANIZATION_ID);
  assert.equal(world.experience, 120);
  assert.equal(world.level, 1);
  assert.deepEqual(world.inventory, { island_signboard: 1 });
});

test("a decision within 24 hours earns the in-time reward", () => {
  const { store, advance } = storeAt("2026-09-27T00:00:00Z");
  const application = store.applyForJob("worker-in-time", {
    jobPostingId: "job-komorebi-20261003",
    workerDisplayName: "はやい",
  });
  assert.ok(application);
  advance(23 * HOUR);
  const decided = store.decideApplication(ORGANIZATION_ID, ACTOR_ID, application.id, {
    decision: "rejected",
  });
  assert.ok(decided.ok);
  assert.ok(rewardCodes(store).includes("application_decided_in_time"));
});

test("a decision after 24 hours earns no in-time reward", () => {
  const { store, advance } = storeAt("2026-09-27T00:00:00Z");
  const application = store.applyForJob("worker-late", {
    jobPostingId: "job-komorebi-20261003",
    workerDisplayName: "おそい",
  });
  assert.ok(application);
  advance(25 * HOUR);
  const before = store.getWorld("organization", ORGANIZATION_ID).experience;
  store.decideApplication(ORGANIZATION_ID, ACTOR_ID, application.id, { decision: "rejected" });
  assert.equal(store.getWorld("organization", ORGANIZATION_ID).experience, before);
  assert.ok(!rewardCodes(store).includes("application_decided_in_time"));
});

test("crossing a level threshold unlocks the next house item", () => {
  const { store } = storeAt("2026-09-27T00:00:00Z");
  const confirmed = store.confirmShift(ORGANIZATION_ID, ACTOR_ID, "shift-demo-koharu");
  assert.ok(confirmed.ok);
  const published = store.publishJob(ORGANIZATION_ID, ACTOR_ID, "job-demo-morning");
  assert.ok(published.ok);
  const decided = store.decideApplication(ORGANIZATION_ID, ACTOR_ID, "application-demo-haruto", {
    decision: "selected",
  });
  assert.ok(decided.ok);
  const evaluated = store.createEvaluation(ORGANIZATION_ID, ACTOR_ID, {
    shiftId: "shift-demo-sota",
    subjectType: "worker",
    subjectId: "worker-demo-sota",
    rating: 4,
    tags: [],
  });
  assert.ok(evaluated.ok);
  const world = store.getWorld("organization", ORGANIZATION_ID);
  assert.equal(world.experience, 160);
  assert.equal(world.level, 2);
  assert.equal(world.inventory.island_bench, 1);
  const worker = store.getWorld("worker", "worker-demo-koharu");
  assert.equal(worker.experience, 40);
});

test("a shift can be marked as a no-show only after it starts", () => {
  const { store, advance } = storeAt("2026-09-27T00:00:00Z");
  const early = store.markNoShow(ORGANIZATION_ID, ACTOR_ID, "shift-demo-rin");
  assert.deepEqual(early, { ok: false, error: "invalid_transition" });
  advance(3 * HOUR);
  const late = store.markNoShow(ORGANIZATION_ID, ACTOR_ID, "shift-demo-rin");
  assert.ok(late.ok);
  assert.equal(late.value.status, "no_show");
});

test("hiring and attendance changes are written to the audit log", () => {
  const { store } = storeAt("2026-09-27T00:00:00Z");
  store.decideApplication(ORGANIZATION_ID, ACTOR_ID, "application-demo-haruto", {
    decision: "selected",
  });
  store.confirmShift(ORGANIZATION_ID, ACTOR_ID, "shift-demo-koharu");
  const actions = store.listAuditLogs(ORGANIZATION_ID).map((entry) => entry.action);
  assert.deepEqual(actions.slice(-2), ["application.selected", "shift.completed"]);
});
