# src/core — local invariants

The engine. Everything here is pure. Read
[`_knowledge/wiki/contracts/step-function.md`](../../_knowledge/wiki/contracts/step-function.md)
before changing `step`.

**Never, in this directory:**

- **No I/O and no Node built-ins.** No `node:fs`, `node:crypto`, `process`,
  `fetch`. This code is bundled for a browser (decision 0001); an import that
  compiles here fails there, at runtime, usually on the deployed page.
- **No `Date.now()`, no `performance.now()`.** Time is `state.tick`.
- **No `Math.random()`.** Randomness is drawn from `state.rngState` via
  `createRng`, and the advanced state is written back into the returned state.
  Nothing else is reproducible.
- **No `Math.sin`, `Math.cos`, `Math.pow`, `Math.exp`.** ECMA-262 leaves their
  precision to the implementation, so results can differ between engines and
  break replay. `+ - * /` and `Math.sqrt` are IEEE-754 exact — stay inside them.
- **No mutation of the input state.** `step` returns a new state; the old one
  must still hash the same afterwards. There is a test for this.
- **No sorting by arrival order.** Ties break on stable keys (dot id, topic
  name), never on the order something happened to arrive in.

**When you add a rule that can refuse an intent**, emit an `intent-rejected`
event with a reason rather than throwing or silently dropping it. Rejection is
normal: it is how a dot learns its action failed.

**When you add a field to `WorldState`**, add it to `canonicalise` in
`hash.ts` too, or two different worlds will hash the same and the determinism
tests will pass on a lie.
