"use strict";

const { createHash } = require("crypto");

/**
 * SAAF (Self-Auditing Async Flow)
 *
 * Extends native Promise to embed a recursive Draft → Critique → Revise cycle with a verifiable audit trail.
 * Produces a tamper-evident hash chain (auditRoot) over all transitions, aiding governance and forensics.
 */
class SAAF extends Promise {
  /**
   * Computes a compact hash chain over the audit history for tamper evidence.
   * Collapses large states using stable JSON and sequential hashing to prevent reordering attacks.
   * @param {Array<object>} auditHistory - Step-by-step audit entries
   * @returns {string} Hex-encoded SHA-256 root
   */
  static computeAuditRoot(auditHistory) {
    let running = Buffer.alloc(0);
    for (const entry of auditHistory) {
      const h = createHash("sha256");
      // Only hash deterministic, minimal fields
      const payload = {
        stepIndex: entry.stepIndex,
        ts: entry.ts,
        phase: entry.phase,
        critiqueCount: Array.isArray(entry.critiques) ? entry.critiques.length : 0,
        // States can be large; serialize deterministically
        inputState: entry.inputState === undefined ? null : entry.inputState,
        draftState: entry.draftState === undefined ? null : entry.draftState,
        finalState: entry.finalState === undefined ? null : entry.finalState,
      };
      const data = Buffer.from(JSON.stringify(payload));
      h.update(running);
      h.update(data);
      running = h.digest();
    }
    return running.toString("hex");
  }

  /**
   * Execute a sequence of self-critiquing steps on a mutable state, returning a thenable with an embedded audit log.
   * Guarantees strict in-order resolution and bounded recursion per step to avoid runaway revise loops.
   *
   * @template T
   * @param {T} initialState - Seed state passed to the first step
   * @param {Array<{draft: (state:T)=>Promise<T>, critique: (state:T)=>Array<any>, revise: (state:T, critiques:Array<any>, prev:T)=>Promise<T>, maxIterations?: number, delayMs?: number}>} steps - Ordered steps with 3-phase functions and optional controls
   * @returns {SAAF} Promise-like SAAF instance that resolves to the final state; inspect `.auditHistory` and `.auditRoot`
   */
  static execute(initialState, steps) {
    const auditHistory = [];

    const run = async () => {
      let state = initialState;

      for (let i = 0; i < steps.length; i += 1) {
        const { draft, critique, revise, maxIterations = 3, delayMs = 0 } = steps[i] || {};

        if (typeof draft !== "function" || typeof critique !== "function" || typeof revise !== "function") {
          const err = new TypeError(`Step ${i} is invalid. Expected functions: draft, critique, revise.`);
          // Record the failure for governance
          auditHistory.push({ stepIndex: i, ts: Date.now(), phase: "invalid", error: err.message, inputState: state });
          throw err;
        }

        const stepStartState = state;
        let draftState;
        try {
          draftState = await draft(stepStartState);
        } catch (e) {
          auditHistory.push({ stepIndex: i, ts: Date.now(), phase: "draft:error", error: e instanceof Error ? e.message : String(e), inputState: stepStartState });
          throw e;
        }

        // Recursive Critique → Revise cycle, bounded by maxIterations
        let current = draftState;
        let critiques = [];
        let iterations = 0;
        for (; iterations < Math.max(1, maxIterations); iterations += 1) {
          try {
            critiques = critique(current) || [];
          } catch (e) {
            auditHistory.push({ stepIndex: i, ts: Date.now(), phase: "critique:error", error: e instanceof Error ? e.message : String(e), draftState: current, inputState: stepStartState });
            throw e;
          }

          if (!Array.isArray(critiques) || critiques.length === 0) {
            // No issues; finalize this step
            auditHistory.push({
              stepIndex: i,
              ts: Date.now(),
              phase: iterations === 0 ? "draft:accepted" : "revise:accepted",
              inputState: stepStartState,
              draftState,
              critiques: [],
              finalState: current,
              iterations,
            });
            state = current;
            break;
          }

          // Apply a targeted revision
          try {
            current = await revise(current, critiques, stepStartState);
          } catch (e) {
            auditHistory.push({ stepIndex: i, ts: Date.now(), phase: "revise:error", error: e instanceof Error ? e.message : String(e), draftState, critiques, inputState: stepStartState });
            throw e;
          }

          if (delayMs > 0) {
            // Minimal backoff to dampen hot loops under heavy revisions
            // eslint-disable-next-line no-await-in-loop
            await new Promise(r => setTimeout(r, delayMs));
          }
        }

        if (iterations >= Math.max(1, steps[i].maxIterations ?? 3) && Array.isArray(critiques) && critiques.length > 0) {
          // Reached iteration cap with remaining critiques; record as capped and proceed to avoid deadlocks
          auditHistory.push({
            stepIndex: i,
            ts: Date.now(),
            phase: "revise:capped",
            inputState: stepStartState,
            draftState,
            critiques,
            finalState: current,
            iterations,
          });
          state = current;
        }
      }

      return state;
    };

    const p = new SAAF((resolve, reject) => {
      run().then(resolve, reject);
    });

    // Attach live audit metadata for immediate inspection
    Object.defineProperties(p, {
      auditHistory: { value: auditHistory, enumerable: true, writable: false },
      auditRoot: {
        enumerable: true,
        get() {
          return SAAF.computeAuditRoot(auditHistory);
        },
      },
    });

    return p;
  }
}

module.exports = { SAAF };


