## SAAF — Self-Auditing Async Flow

Self‑Auditing Async Flow (SAAF): Promise‑based Draft - Critique - Revise with tamper‑evident audit history.

SAAF embeds a recursive Draft → Critique → Revise cycle directly into an async flow, yielding a verifiable audit trail and a tamper-evident hash chain. It eliminates deep resolve chains and provides governance-grade observability without sacrificing ergonomic Promises.

### Installation

```bash
npm install
```

### Usage

```js
// When used via this repo
const { SAAF } = require("./index");

// When published as a package
// const { SAAF } = require("saaf");

(async () => {
  const steps = [
    {
      draft: async (s) => ({ ...s, draft: (s.value || 0) + 1 }),
      critique: (s) => (s.draft % 2 === 0 ? ["must be odd"] : []),
      revise: async (s, critiques) => ({
        ...s,
        draft: s.draft + 1,
        fixed: critiques.length,
      }),
    },
  ];

  const flow = SAAF.execute({ value: 0 }, steps);
  const result = await flow; // final state

  console.log("final", result);
  console.log("audit entries", flow.auditHistory.length);
  console.log("audit root", flow.auditRoot);
})();
```

### Architectural Justification

- **Bounded recursion, no memory debt**: The Draft → Critique → Revise loop is internal and capped, removing unbounded nested Promises and avoiding deep resolve chain pressure.
- **DLT-grade assurance**: Each step contributes to a SHA-256 hash chain (`auditRoot`), making the flow’s history tamper-evident and governance-friendly without external infra.

### Scripts

```bash
# run unit tests
npm test

# start localhost demo server on :3000
npm start
# then visit: curl -s http://localhost:3000/run | jq .

# run CLI demo
npm run demo
```

### Repository

- Source: `index.js`
- Tests: `test/index.test.js`
- Demo CLI: `demo.js`
- Demo Server: `server.js` (GET /run)
