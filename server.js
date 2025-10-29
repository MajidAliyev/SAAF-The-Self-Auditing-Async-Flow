"use strict";

const http = require("http");
const { SAAF } = require("./index");

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url && req.url.startsWith("/run")) {
    try {
      const steps = [
        {
          draft: async (s) => ({ ...s, draft: (s.value || 0) + 1 }),
          critique: (s) => (s.draft % 2 === 0 ? ["must be odd"] : []),
          revise: async (s, critiques) => ({ ...s, draft: s.draft + 1, fixed: critiques.length }),
        },
      ];

      const flow = SAAF.execute({ value: 0 }, steps);
      const result = await flow;

      const body = JSON.stringify({ result, auditEntries: flow.auditHistory.length, auditRoot: flow.auditRoot });
      res.writeHead(200, { "content-type": "application/json", "content-length": Buffer.byteLength(body) });
      res.end(body);
    } catch (err) {
      const body = JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
      res.writeHead(500, { "content-type": "application/json", "content-length": Buffer.byteLength(body) });
      res.end(body);
    }
    return;
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("Not Found\n");
});

server.listen(port, () => {
  // Intentionally quiet; this is a demo server.
});


