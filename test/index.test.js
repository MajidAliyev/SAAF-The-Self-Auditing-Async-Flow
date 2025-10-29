"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { SAAF } = require("../index");

test("SAAF resolves final state and exposes audit", async () => {
  const steps = [
    {
      draft: async (s) => ({ ...s, v: (s.v || 0) + 1 }),
      critique: (s) => (s.v < 2 ? ["too small"] : []),
      revise: async (s) => ({ ...s, v: s.v + 1 }),
    },
  ];

  const flow = SAAF.execute({ v: 0 }, steps);
  assert.ok(flow instanceof Promise);
  assert.ok(flow instanceof SAAF);

  const final = await flow;
  assert.equal(final.v, 2, "value revised to pass critique");
  assert.ok(Array.isArray(flow.auditHistory));
  assert.ok(flow.auditHistory.length >= 1);
  assert.match(flow.auditRoot, /^[a-f0-9]{64}$/);
});

test("Recursive loop caps at maxIterations and proceeds", async () => {
  const steps = [
    {
      draft: async (s) => ({ ...s, v: 0 }),
      critique: (s) => (s.v !== 3 ? ["not three"] : []),
      revise: async (s) => ({ ...s, v: s.v + 1 }),
      maxIterations: 2, // can’t reach 3; should cap and move on
    },
  ];

  const flow = SAAF.execute({}, steps);
  const final = await flow;
  // After draft (0), two revisions (1, then 2), capped with remaining critique
  assert.equal(final.v, 2);
  const capped = flow.auditHistory.find((e) => e.phase === "revise:capped");
  assert.ok(capped, "capped entry recorded");
});

test("Pass-through when no critiques", async () => {
  const steps = [
    {
      draft: async (s) => ({ ...s, ok: true }),
      critique: () => [],
      revise: async (s) => ({ ...s, touched: true }),
    },
  ];

  const final = await SAAF.execute({}, steps);
  assert.equal(final.ok, true);
  assert.equal(final.touched, undefined, "revise not called when no critiques");
});

test("Invalid step surfaces error and audits", async () => {
  const steps = [
    { draft: async () => ({}), critique: () => [], revise: async (s) => s },
    // malformed step
    { draft: null, critique: () => [], revise: async (s) => s },
  ];

  const flow = SAAF.execute({}, steps);
  await assert.rejects(() => flow);
  const invalid = flow.auditHistory.find((e) => e.phase === "invalid");
  assert.ok(invalid);
});


