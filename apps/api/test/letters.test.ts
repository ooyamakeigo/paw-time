import assert from "node:assert/strict";
import test from "node:test";
import { app } from "../src/app.js";

const businessHeaders = {
  "content-type": "application/json",
  "x-organization-id": "org-komorebi",
  "x-actor-id": "member-demo",
};

type Json = Record<string, unknown>;

async function send(body: unknown, headers: Record<string, string> = businessHeaders) {
  const response = await app.request("/v1/business/letters", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json()) as Json };
}

async function experience(): Promise<number> {
  const response = await app.request("/v1/business/world", { headers: businessHeaders });
  const body = (await response.json()) as { data: { experience: number } };
  return body.data.experience;
}

test("a preset letter reaches the worker and earns XP once per shift", async () => {
  const before = await experience();

  const preset = await send({ shiftId: "shift-demo-sota", template: "come_again" });
  assert.equal(preset.status, 201);
  assert.equal((preset.body.data as { body: string }).body, "またきてにゃん");
  assert.equal((preset.body.data as { workerId: string }).workerId, "worker-demo-sota");
  assert.equal(await experience(), before + 5);

  const custom = await send({
    shiftId: "shift-demo-sota",
    template: "custom",
    body: "  次は土曜もお願いにゃん  ",
  });
  assert.equal(custom.status, 201);
  assert.equal((custom.body.data as { body: string }).body, "次は土曜もお願いにゃん");
  assert.equal(await experience(), before + 5);

  const inbox = await app.request("/v1/worker/letters", {
    headers: { "x-user-id": "worker-demo-sota" },
  });
  assert.equal(inbox.status, 200);
  const letters = ((await inbox.json()) as { data: Array<{ body: string }> }).data;
  assert.deepEqual(
    letters.map((letter) => letter.body),
    ["またきてにゃん", "次は土曜もお願いにゃん"],
  );

  const sent = await app.request("/v1/business/letters", { headers: businessHeaders });
  const sentBodies = ((await sent.json()) as { data: Array<{ shiftId: string }> }).data;
  assert.ok(sentBodies.some((letter) => letter.shiftId === "shift-demo-aoi"));
  assert.equal(sentBodies.filter((letter) => letter.shiftId === "shift-demo-sota").length, 2);
});

test("letters need a finished shift and some words", async () => {
  const scheduled = await send({ shiftId: "shift-demo-rin", template: "thank_you" });
  assert.equal(scheduled.status, 409);
  assert.equal(scheduled.body.error, "invalid_transition");

  const working = await send({ shiftId: "shift-demo-yu", template: "thank_you" });
  assert.equal(working.status, 409);

  const checkedOut = await send({ shiftId: "shift-demo-koharu", template: "be_on_time" });
  assert.equal(checkedOut.status, 201);
  assert.equal((checkedOut.body.data as { body: string }).body, "遅刻は厳禁だにゃん");

  const empty = await send({ shiftId: "shift-demo-koharu", template: "custom", body: "   " });
  assert.equal(empty.status, 400);
  assert.equal(empty.body.error, "empty_letter");

  const unknownTemplate = await send({ shiftId: "shift-demo-koharu", template: "hug" });
  assert.equal(unknownTemplate.status, 400);
  assert.equal(unknownTemplate.body.error, "invalid_request");

  const otherOrganization = await send(
    { shiftId: "shift-demo-koharu", template: "thank_you" },
    { ...businessHeaders, "x-organization-id": "org-other" },
  );
  assert.equal(otherOrganization.status, 404);

  const anonymous = await app.request("/v1/worker/letters");
  assert.equal(anonymous.status, 401);
});
