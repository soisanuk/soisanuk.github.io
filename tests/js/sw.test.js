// Tests for the service worker's range replies (web/sw.js _rangeResponse).
// Safari plays cached audio only when a Range request gets a real 206.
// sw.js registers listeners at load, so it runs here against a stub `self`.
// Run with: node --test tests/js/

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

globalThis.self = { addEventListener() {} };
vm.runInThisContext(readFileSync(new URL("../../web/sw.js", import.meta.url), "utf8"), { filename: "sw.js" });

const body = new Uint8Array(100).map((_, i) => i);
const full = () => new Response(body, { status: 200, headers: { "Content-Type": "audio/mpeg" } });
const bytes = async r => [...new Uint8Array(await r.arrayBuffer())];

test("a closed range comes back as a 206 slice with the right headers", async () => {
  const r = await _rangeResponse(full(), "bytes=10-19");
  assert.equal(r.status, 206);
  assert.equal(r.headers.get("Content-Range"), "bytes 10-19/100");
  assert.equal(r.headers.get("Content-Length"), "10");
  assert.equal(r.headers.get("Content-Type"), "audio/mpeg");
  assert.deepEqual(await bytes(r), [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
});

test("open-ended and suffix ranges", async () => {
  // Safari's first probe
  const probe = await _rangeResponse(full(), "bytes=0-1");
  assert.deepEqual(await bytes(probe), [0, 1]);
  const open = await _rangeResponse(full(), "bytes=95-");
  assert.equal(open.headers.get("Content-Range"), "bytes 95-99/100");
  const suffix = await _rangeResponse(full(), "bytes=-3");
  assert.deepEqual(await bytes(suffix), [97, 98, 99]);
  const past = await _rangeResponse(full(), "bytes=90-500");
  assert.equal(past.headers.get("Content-Range"), "bytes 90-99/100");
});

test("an unsatisfiable or malformed range gets the whole body", async () => {
  for (const h of ["bytes=200-300", "bytes=5-2", "items=0-1", "bytes=0-1,5-6"]) {
    const r = await _rangeResponse(full(), h);
    assert.equal(r.status, 200, h);
    assert.equal((await bytes(r)).length, 100, h);
  }
});
