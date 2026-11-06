import { test } from "node:test";
import assert from "node:assert/strict";
import { checkBackend } from "../deploy/keep-alive/worker.js";

test("scheduled health verifies the real JSON response without changing data", async () => {
  let calls = 0;
  const result = await checkBackend(
    { BACKEND_ORIGIN: "https://api.example.com" },
    async (url, options) => {
      calls++;
      assert.equal(url.href, "https://api.example.com/api/health");
      assert.equal(options.redirect, "manual");
      assert.equal(options.body, undefined);
      assert.ok(options.signal instanceof AbortSignal);
      return Response.json({ ok: true });
    },
  );
  assert.equal(calls, 1);
  assert.equal(result.ok, true);
});

test("provider challenges and invalid health responses fail the scheduled invocation", async () => {
  for (const response of [
    new Response("challenge", { status: 429 }),
    new Response("HTML"),
    Response.json({ ok: false }),
  ]) {
    await assert.rejects(
      checkBackend(
        { BACKEND_ORIGIN: "https://api.example.com" },
        async () => response,
      ),
    );
  }
});

test("invalid configured origins never receive a request", async () => {
  for (const origin of [
    "http://example.com",
    "https://user:secret@example.com",
    "https://example.com/path",
    "https://example.com?key=secret",
  ]) {
    await assert.rejects(
      checkBackend({ BACKEND_ORIGIN: origin }, () =>
        assert.fail("Unexpected network request"),
      ),
    );
  }
});
