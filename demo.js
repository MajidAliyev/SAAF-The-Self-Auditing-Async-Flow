const { SAAF } = require('./index');
(async () => {
  const steps = [
    {
      draft: async (s) => ({ ...s, draft: (s.value || 0) + 1 }),
      critique: (s) => (s.draft % 2 === 0 ? ['must be odd'] : []),
      revise: async (s, critiques) => ({ ...s, draft: s.draft + 1, fixed: critiques.length }),
    },
  ];
  const flow = SAAF.execute({ value: 0 }, steps);
  const result = await flow;
  console.log(JSON.stringify({ result, auditEntries: flow.auditHistory.length, auditRoot: flow.auditRoot }, null, 2));
})();
