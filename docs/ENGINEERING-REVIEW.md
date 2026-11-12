# Engineering review

2026-11-12. A pass over this codebase as a senior engineer would take it over: the
architecture and the data flow, the structural problems, the duplication, the
performance bottlenecks, and what was changed. Every "fixed" line below is in the
repository and covered by a check.

The reference for the shape of the answer was **Vigil** (`github.com/unifyWeb3/vigil`),
which the author built earlier and which has the architecture this project was missing:
a pnpm monorepo, `apps/web` split into pages / hooks / lib, one hook per resource,
a page layer that never imports the SDK directly, and a pluggable adapter interface
with two implementations.

---

## 1. The architecture as it was

```
npm run demo
  └─ src/agent.ts        SERV Reasoning decides → kpass executes → log.append()
  └─ src/kpass.ts        wraps the kpass CLI (the only thing that touches money)
  └─ src/menu.ts         the catalog, filtered
  └─ src/log.ts          append-only keccak-256 hash chain
        │
        ▼
docs/decision-log.jsonl ──▶ scripts/rebuild-receipts.ts ──▶ docs/receipts.json
                                                              │
                                        ┌─────────────────────┴────────────────────┐
                                        ▼                                          ▼
                            src/app.ts (Express)                         scripts/verify.ts
                              /proof.json  (re-reads the chain)           15 checks, exit 0
                              /decision-log.jsonl
                              /verify?log=  (third party's log)
                                        │
                                        ▼
                              public/index.html   (one 962-line file:
                                                   HTML + CSS + JS + the payload shape)
```

Four things were wrong with that picture.

## 2. Structural problems

### 2.1 The page was a monolith, and it owned the payload shape — **fixed**

`public/index.html` was 962 lines with the markup, the styles, the rendering and the
knowledge of every field of the proof payload in one file. There was no layer between
the network and the markup.

The page is now four files in the shape Vigil uses:

| File | Responsibility |
| --- | --- |
| `public/index.html` | structure only — 110 lines |
| `public/app.css` | the visual system |
| `public/lib/api.js` | **owns the payload shape.** The page never touches it |
| `public/lib/format.js` | pure functions: money, escaping, the Passport's error codes |
| `public/lib/render.js` | one function per section |
| `public/app.js` | the controller: decides which record to show, asks the renderers to draw it |

### 2.2 The deployment was not reproducible, and it was not what it claimed — **fixed**

There was no `vercel.json`, so a judge could not redeploy it. Worse: when one was
added with a rewrite, the deployment silently lost `public/` and `docs/` from the
function bundle, because Vercel traces only the files it can prove a function reads.
`/proof.json` kept working — it reads one traced file — while the page 404'd and the
published log was missing.

Two fixes: the log is now imported as a module, so it is in the bundle by
construction, and `vercel.json` names the entry point and its duration. The
`/healthz` endpoint now reports what the deployment can actually read, so this class of
failure is visible instead of silent.

### 2.3 The secrets were being uploaded — **fixed**

The Vercel CLI uploads the working tree, so `.gitignore` alone did not keep
`.env`, `.kite-passport/runtime.key`, `.kite-passport/config.json` and
`.secrets/seller.key` out of the deployment. They were never in git and never on
GitHub — those were checked — but they were in the uploaded source. `.vercelignore`
now excludes them explicitly.

This mattered more than a routine tidy-up: the agent's runtime key is what makes the
attestation meaningful. If it had been publicly readable, anyone could have signed a
record as our agent.

### 2.4 The browser modules were written in TypeScript — **fixed**

`public/lib/api.js` contained `export interface` and `Promise<Proof>`. The browser
parsed it as a classic script and died with `Unexpected token 'export'`. The modules
are plain JavaScript now, with the types in JSDoc.

## 3. Duplication

| Duplication | Where | Resolution |
| --- | --- | --- |
| Dollars to base units, three times | `kite.ts:83`, `kite.ts:119`, `proof.ts:290` | one implementation, `src/units.ts`, on the decimal string and never on a float |
| The chain facts, in four places | `kite.ts`, `proof.ts`, `menu.ts`, `build-menu.ts` | one registry, `src/chains.ts`, resolved by name, by network or by id |
| The receipts document, built twice | `run-demo.ts` and `rebuild-receipts.ts` each assembled the same forty lines | one builder, `src/records.ts`, and one entry point, `src/artifact.ts`. The two paths cannot disagree now |
| Two parsers for the model's answer | `serv.ts` (tested) and `agent.ts` (untested, and it dropped the `id`) | one parser, and it keeps every field the model sent |
| The spend arithmetic | `generate-claims.ts`, `build-menu.ts`, `agent.ts` | `src/units.ts` |

The parser duplication was not cosmetic. `serv.ts`'s parser returned a fixed shape and
silently dropped the `id`, and the agent used it, so every decision the model made —
and the model was always right, returning `"id":"e09"` — was read as "no endpoint
named" and **the agent bought nothing**. Two runs were lost to that.

## 4. Performance

| Problem | Resolution |
| --- | --- |
| The chain head was read once per paid step | one read per record, shared by every check |
| Every receipt was re-read on every request | receipts are cached; a mined transaction's receipt is immutable |
| The checks ran one after another | they run in parallel |
| The receipts were read from disk on every request | they are, but the file is small and the read is local |

`/proof.json` went from six RPC round trips to three, and to none after the first
request. It answers in **0.8–1.4s**, and the second request is faster still.

## 5. Correctness

- A chain that cannot be read was reported as a **failed verification**, in red. It is
  now `unavailable`, which is a third state, and the page says "could not read".
- The receipts took the session caps from *whichever session was current*, so opening a
  second session silently rewrote the first run's budget and every number derived from
  it. Each log record now carries the session that produced it, and the rebuild
  prefers the log, then the previous receipts, and never the current session.
- The cost of the limit divided by the wrong budget — the same bug, one layer down.
- A purchase could be made for the wrong endpoint when the model mangled an id. The
  fuzzy resolver is gone; a purchase needs an exact id.
- `spent_total_after` was `null` on every step. It is the running total now, and a
  refusal does not move it.

## 6. What is still open

| Problem | Why it is open | What it would take |
| --- | --- | --- |
| The refusals are not chain-verified | there is nothing to anchor them to | an attestation transaction per refusal, signed by the agent. Needs the owner's wallet and a few cents of gas |
| Everything is a file in the repository | there is no database, by design: the owner keeps their data | a store, if we ever want to host other people's records rather than fetch them |
| The page has no build step | the deployment serves the modules as they are | a bundler, when the UI grows past a few modules |
| The chain reads are per-instance | a cold function re-reads the chain | an edge cache, which the responses already advertise (`max-age=30`) |
| The log's format is ours | a third party has to write in it to get the hash chain checked | publish the format, and a small package that writes it |

## 7. The answer to "how would a third party use this"

It was the right question to ask, and the honest answer before this pass was: *they
would not.* There was a demo, a proof page and a CLI that needed your own funded
Passport. Nothing a stranger could use.

There is now one path:

```
GET /verify?log=https://wherever/the/log/is
```

An agent owner publishes their decision log and hands the link to whoever needs to see
it — a customer, an auditor, the person disputing a charge. Capsule fetches the log,
checks its hash chain, reads every payment off the chain, and answers what was really
bought, what was refused and why, and what the limit cost. The owner keeps their
data; nothing is stored here.

The page renders the same way, so a reader can check it without reading JSON.

This is the product the brief was reaching for. "The owner's record" is not a
positioning line; it is a URL that somebody else can be given.
