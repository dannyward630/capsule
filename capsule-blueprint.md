# Capsule — how to make it unique
### Data flow · HCI · architecture · the algorithm worth having

Companion to `audit.md`. Everything below is verified against the live deployment, the live chain
and the current `master` (commit `3f74e35`).

---

## 0. The quiz

> **What is a key advantage of a Smart Contract Account (SCA) that the video highlights?**
> A — simpler and less flexible than an EOA · **B — programmable, allowing for custom authorization rules and account abstraction** · C — it can only be controlled by the application developer

**B is correct.** An SCA is a program, so the authorization policy is code rather than a property of
the key: it can require a session key with a spend cap, a per-method allowlist, a counterparty
allowlist, a rate limit, or a cosigner — and the chain enforces that before execution, instead of
the application's code deciding after the fact.

Worth noticing while you are there: **B is a description of Capsule.** A Kite Passport session is
exactly "custom authorization rules and account abstraction" for a spending agent. Vigil's video
teaches the concept; Capsule is the same concept instantiated for a specific job. That is your
positioning, and it is stronger than "we built a cap".

---

## 1. What the engineering pass actually got right (verified, not read)

The agent's pass was substantial and most of it is real:

| Claim | Verified how |
| --- | --- |
| `npm run verify` → **15/15** against the live deployment | I ran it. The `ksearch`-missing failure I flagged in `audit.md` is **fixed** — the attestation check now reads Kite's public key set over plain HTTPS, and it recovers `0x5512caEe…` |
| **36/36** tests pass, `tsc` clean | I ran `npm test` and `npm run typecheck` |
| The critical README-table bug is fixed | The run table is now generated: `<!-- BEGIN:GENERATED -->` … `npm run readme` from `docs/receipts.json` (`scripts/generate-readme.ts`). It cannot drift again |
| The contrast run is real | `docs/runs/contrast/`: cap **$0.06/tx, $0.1 total** → 3 settled, 0 refused, $0.052 spent. I re-read all three on Base: `0xde340733…` (1000 units), `0xb0cc177c…` (1000), and **`0xd769e940…` (50 000 units)** — the Google Trends endpoint that was **refused** at the $0.002 cap **settled** at the $0.06 cap. That is a genuine controlled A/B, and it is the strongest single piece of evidence in the repo |
| The third-party path works and is hardened | Live `/verify?log=…` returns `status: verified`, `log_chain: verified`. SSRF: **4/4 blocked** — `http://127.0.0.1`, `https://localhost`, `file:///etc/passwd`, `https://169.254.169.254/latest/meta-data/` all → HTTP 400 |
| The page does consume `/verify?log=` | `public/lib/api.js:86,101` fetch it and read `?log=` from the URL. The claim "the page renders it too" is true |
| `vercel.json` + `.vercelignore` exist | The deploy-reproducibility and the "the Vercel CLI uploaded `.env` and `runtime.key`" findings are fixed |
| "What the limit cost" exists | `src/counterfactual.ts` + `docs/receipts.json` → `refused_usd: $0.051`, `budget_multiplier: 20.4` at a $0.0025 budget |

This is a much better repo than the one I audited. Three things remain, and then the strategy.

### Gap 1 — the third-party path cannot show the headline number (10-minute fix)

The published log at `/decision-log.jsonl` is the **old format with no `session` field**. So a third
party gets:

```
session:   { id: null, max_amount_per_tx: null, max_total_amount: null }
totals:    { spent_usd: "0.002", refused_usd: "0.051", budget_multiplier: null }
```

`budget_multiplier` is null because the budget comes from the log's session
(`src/verify-log.ts:237`) and there isn't one. The visitor has to supply the owner's own budget
themselves — `&budget=0.0025` → **20.4**, `&budget=0.05` → 1.02 (I tested both).

The session-bearing format already exists (`docs/decision-log.json`, and the contrast log) — it just
isn't published. **Publish `docs/decision-log.jsonl` with sessions, or publish the contrast log, and
the third-party path shows the one number the whole project is about.** The contrast log 404s today
(`/runs/contrast/decision-log.jsonl` → 404) and `decision-log.json` 404s too.

### Gap 2 — the multiplier on the third-party path is the owner's own claim

`refused_usd` is computed from the prices **in the log the owner published**. `spent_usd` is
chain-verified; `refused_usd` is not, and cannot be — refusals leave no transaction. That is the
known gap you already named.

But it is also the product's thesis, and right now the UI presents both as one flat total. Say it:
**"the purchases are chain-verified; the refusals are the owner's claim. That asymmetry is exactly
why the refusals are the valuable part and also the unproven part."** Then the fix (an attestation
transaction per refusal) becomes the obvious next step rather than a footnote.

### Gap 3 — a DNS-rebinding window in `src/net.ts`

`assertFetchable()` resolves the host and checks every address (`net.ts:98-106`), then `fetch()`
resolves it **again** (`net.ts:124`). Between the two, a hostile DNS server can answer with a public
address and then a private one. Classic TOCTOU SSRF. Fix: connect to the address you already
checked (undici `Agent` with a custom `connect`, preserving SNI/Host), or re-check after resolution
and pin.

---

## 2. Who uses this? (your "is it not for other party" question)

Today the answer is **two parties, and the second one is a closed loop**.

**Party 1 — the owner.** Their own live record. Works. `/proof.json`, the page, the console.

**Party 2 — someone handed a link.** The agent's `/verify?log=` answer is right, and it is a real
advance: "a spending record, checked by someone who did not write it."

But the loop closes on itself. `src/verify-log.ts:86` — `isCapsuleLog()` — and the code's own note
say it:

> *"This log is not in Capsule's hash-chained format, so its hash chain was not checked. **The
> payments below were still verified against the chain.**"*

**That is the network effect, already built and not yet claimed.** `verifyPublishedLog()` will
verify *any* log that carries `decision.kind` and `tx_hash`, whether or not the author ever used
Capsule. The product is not "a verifier for Capsule logs". It is:

> **Capsule verifies any agent's spending record. The payments are checked against the chain; the
> refusals are the author's claim; the hash chain is a bonus for people who write in our format.**

That is a one-paragraph README change and it moves you from "a tool" to "a standard". Push it hard.

**Party 3 — the missing one, and it is the real business.** The person who *sets* the cap.

They are not the owner and not the customer; they are the operator who decides "$0.0025 per hour,
$0.002 per call" for an agent that spends on their behalf. Today they set that number blind. Capsule
is the only thing in the field that can tell them **what that number cost them**. That is party 3,
and party 3 is the payer.

---

## 3. The unique thing: the price of a limit

Look at what you already have in the repo:

> *"The limit cost **$0.051** of evidence against a **$0.0025** budget — **20.4× the whole budget**."*

Nobody else in this field can compute that number, because computing it needs three things and only
you have all three:

1. **The refusal record** — what the agent *wanted* and was refused. (Capsule and the Passport model
   only. Capsule/Tare/Tender have no refusals at all.)
2. **The real price of the refused endpoint** — from the x402 challenge, not from us.
3. **The budget it was measured against** — the number the user actually signed with a passkey.

The contrast run makes it **causal**, not correlational: at $0.06 the same endpoint settled
(`0xd769e940…`, 50 000 units). You did not observe a cap being hit. You ran the experiment twice
with one variable changed and got different outcomes. **No other entry in this field has an
experiment.**

So the one-liner for the README, the X post and the demo:

> **Capsule is the only thing that can tell you what your spending limit cost you.**
>
> Your agent asked for $0.05 of market data. Your cap was $0.002. The Passport refused it. That
> $0.05 was 20× your entire budget — and nobody knew, because nothing else records what an agent
> was refused. We do, and we check it against the chain.

And the product form of that sentence is a **cap calculator**, not a cap.

---

## 4. The algorithm (the "DSA" you asked for)

`src/counterfactual.ts` today is a **per-fact greedy**: `bestEndpointForFact(menu, fact)` finds the
cheapest endpoint that mentions that fact. That answers "what might have covered this fact". It does
**not** answer the question a person setting a cap actually has:

> **"What is the cheapest way to get the answer I asked for?"**

### The problem

Let `F` be the facts the answer needs. Let the live Kite catalog be `E`, where each endpoint `e`
has a price `c(e)` and a coverage set `cov(e) ⊆ F` (the facts its response would actually support).
Given budget `B`:

```
τ*(F) = min { Σ c(e) :  ∪_{e ∈ S} cov(e) = F }        (minimum cost to complete the answer)
```

This is **budgeted weighted set cover** — NP-hard in general. But `|F|` is the number of facts in one
answer, typically 3–8. For `|F| ≤ 12` you can solve it **exactly** by enumerating coverage masks:
`O(2^|F| · |E|)` — 4096 masks at 12 facts, instant, and completely checkable. Beyond that, greedy +
beam, and **say which one you used**. Your repo's culture of honest disclosure fits this perfectly.

### The outputs (four numbers nobody else can produce)

| Output | Meaning | Why it matters |
| --- | --- | --- |
| `min_cost_to_complete` = τ*(F) | the cheapest complete answer | the honest price of the task |
| `cap_damage_usd` = τ*(F) − B | what the cap destroyed, in dollars | **the headline number** |
| `recommended_cap` | the smallest B′ ≥ τ*(F) | *the product*: "set your cap to $0.051 and this answer completes" |
| `uncoverable_facts` | facts **no** endpoint covers | real gaps in the catalog — the agent was never going to get "main risk factors" at any budget |

Plus the per-fact residual, which is the most human sentence in the whole product:

> *"Fact 3 (trend over the last month) costs $0.05 on its own. Your per-call cap is $0.002."*

### The incremental version — the live meter

`counterfactual.ts` is already recomputed from the log. Make it recompute **as attempts stream in**:
maintain the residual uncovered set, re-solve τ* on the residual, and emit the **marginal value of
each refusal**:

```
attempt 2 refused  →  residual cover now costs $0.050 more than before  →  "this refusal cost you $0.050"
attempt 3 refused  →  residual cover now costs $0.001 more than before  →  "this one cost you $0.001"
```

That is a **real-time counterfactual meter**: the running cost of the limit, priced, updated as the
agent spends. It is the single most novel thing in this field, and it falls out of the architecture
below.

**Cost:** ~150 lines in `src/cover.ts` + 12 unit tests. **This is your DSA.**

---

## 5. Architecture — one core, adapters at the boundary

You already did this once, in the front end: `public/lib/{api,format,render}.js` with "pages import
from here, never from `api.js` directly". Good instinct. **Now do it where it matters**, and it is
the same shape Vigil used (`ISettlementAdapter` with two implementations).

Today the two entry points are two implementations of overlapping logic:

```
GET /proof.json  → src/app.ts  → own receipts → own chain reads
GET /verify?log= → src/verify-log.ts → fetch → parse → own chain reads
```

`src/proof.ts` already has the right primitive — `ChainReader` (cached head + cached receipts) and
`verifyStep(step, chain, expectedAmount, expectedSender, reader)` with a tri-state
`confirmed | mismatch | unavailable`. **Reuse it. Do not write a second verifier.**

### The target shape

```
src/
  core/                     ← pure. no fetch, no fs, no process.env, no clock
    types.ts                LogRecord · PublishedRecord · Verdict · ChainCheck
    hashchain.ts            keccak chain check (pure)
    verifier.ts             verify(log, ctx) → Verdict       ← ONE verifier
    counterfactual.ts       refusals → priced attempts (pure)
    cover.ts                min-cost set cover (pure)
    pricing.ts              dollars ⇄ base units (pure)
  adapters/                 ← the pluggable boundary
    log-source.ts           interface LogSource { read(): Promise<LogRecord[]> }
      · LocalLogSource        our own run
      · RemoteLogSource       someone else's published log (the SSRF guard lives HERE)
      · ThirdPartyLogSource   someone else implements ONE method
    chain.ts                ChainReader (Base | Kite)        ← already exists
    catalog.ts              CatalogSource (menu.json | live ksearch | snapshot)
    clock.ts                now() — so tests are deterministic
  entrypoints/
    proof.ts                GET /proof.json      → verifier + LocalLogSource
    verify.ts               GET /verify?log=     → verifier + RemoteLogSource
  app.ts                    routes, adapters, nothing else
```

**Why this is the answer to "is it for other parties":** the adapter boundary is where third
parties plug in. A stranger implements **one method** — `read(): Promise<LogRecord[]>` — and their
agent's log gets verified by Capsule's core, with Capsule's chain checks, Capsule's counterfactual
and Capsule's cap calculator. They do not adopt Capsule's log format, do not use Capsule's agent,
do not give Capsule their keys. **The format becomes an interface instead of a format.** That is a
half-day of work and it is the difference between a demo and a standard.

The second reason to do it: it removes the duplication the engineering review just flagged in
yourself, at the one place it is about to bite (two entry points, two code paths, one bug fixed in
one and not the other).

---

## 6. HCI — the routes

Vigil has 13 routes. You do not need 13. You need **five**, and you need them to be *different
questions*, not different sections of one long page.

| Route | What it is | Why it exists |
| --- | --- | --- |
| `/` | the owner's live record | exists; keep it |
| **`/verify`** | **an interactive trace**, not a JSON dump | *the third-party path, made visible.* Today `/verify` returns JSON and the page renders it — but a reader should see the **check happen**: *fetched → parsed → hash chain intact → 2 transfers confirmed on Base → 2 refusals → the limit cost $0.051*. A trace teaches trust; a JSON blob asks for it. This is Vigil's `/probe` route transplanted |
| **`/runs`** and **`/runs/:id`** | a list of runs and one run | you now have **two** runs (recorded + contrast) and they live in `docs/runs/contrast/`. Make the run a first-class, addressable object. The A/B becomes legible in the UI instead of a README table, and it is the strongest thing you own — so give it a screen |
| **`/caps`** | the cap calculator | the interactive DSA. Pick your required facts, see the live catalog's coverage, get τ*, the recommended cap and the damage your current cap did. **This is the page that justifies the product** |
| **`/docs/security-model`** | what Capsule does **not** prove | the refusals are unproven. Say so in your own words, prominently. This is the page a `security` judge reads, and Tare/ASSAY both won points by being the entry that said the uncomfortable thing first |

Plus, cheap and worth it: `/docs/format` — the log format spec and a 20-line writer package.
That is the "publish the format" half-day the agent already identified, and it is what makes party-3
tooling possible.

**Design notes from Vigil worth copying (shape, not code):** per-route `<title>`/description
(`lib/seo.ts` — 10 lines, and it makes the demo link look like a product in a timeline); a `ui/`
component file with `Badge`, `Layout`, `WalletButton` (your analogue is a "Verify a log" input, not a
wallet button); and a **probe page** that runs a live diagnostic.

**Do not copy:** Vigil's visual identity. Your page is a ledger; a ledger should look like a
ledger. "The result is quiet, typographic, and confident: it looks like infrastructure, because it
is" (Vigil `README.md:319`) — take the principle, not the palette.

---

## 7. Why Vigil lost, and what to take from it

I have **no judge feedback**, so I will not invent a reason. What I can observe structurally:

- **A load-bearing concession.** `docs/GATE_ZERO_REPORT.md`: *"the SDK does not encrypt client-side
  in beta.13… Confidentiality of inputs therefore rests on TLS + trust in the gateway."* For a
  project whose entire thesis is *confidential execution*, the confidentiality of the encrypted
  condition resting on TLS + the gateway is the kind of thing a `security` judge reads twice.
- **The spec was not in the repo.** The same report: *"docs/VIGIL_ARCHITECTURE.md … is absent from
  the repo — docs/ was empty. VT-002 was executed from the task brief alone."* A judge reads the
  repo, not the brief.
- **Enormous surface.** TEE + gateway + registry + keeper + SDK + a 13-route SPA. Every part is
  individually impressive and the whole thing is one question: *does it run?*

**The lesson for Capsule is the opposite of "go bigger".** Vigil's problem is breadth without
provable depth; Capsule's opportunity is **depth that is provably real**:

| Take from Vigil | Apply to Capsule |
| --- | --- |
| A named architectural boundary with pluggable implementations | `ISettlementAdapter` → `LogSource` / `ChainReader` / `CatalogSource` (§5) |
| A docs surface with how-it-works / architecture / security-model | the same four, and `security-model` is where you admit the refusal gap |
| A live probe page | `/verify` as an interactive trace |
| A per-run, per-record evidence trail | you already have it; put it on a screen (`/runs/:id`) |
| `docs/DECISIONS.md` as a first-class artifact | you have `docs/EVENT-RULES.md`; add `docs/DECISIONS.md` for *your* build, with the reason and the date for each choice |
| **Do not copy** the scope | one algorithm (the cover solver), one adapter boundary, one claim ("the price of a limit") |

---

## 8. The plan, in order

**First, the two hours that pay for everything else** (these make the *existing* work legible to a judge):

1. **Publish a session-bearing log.** Then `/verify` shows `session` and `budget_multiplier: 20.4`
   with no query parameter. *(10 min — the fix for Gap 1)*
2. **Publish the contrast log and put the A/B on the page.** You have a controlled experiment; give
   it a screen (`/runs` + `/runs/:id`). *(1 h)*
3. **Rewrite the README's first paragraph as "the price of a limit"** and lead with
   `$0.051 of evidence against a $0.0025 budget — 20.4×`. Then the contrast run as the proof of
   causation. *(45 min — the highest-leverage copy change in this list)*
4. **Claim the network effect you already built**: "verifies **any** agent's spending record; the
   payments are chain-verified, the refusals are the author's claim, the hash chain is a bonus for
   people who write in our format." *(20 min)*

**Then the uniqueness work:**

5. **`src/cover.ts` — exact min-cost set cover.** τ*, cap damage, recommended cap, uncoverable
   facts. Exact for ≤ 12 facts; greedy beyond; say which. *(3 h)*
6. **A `/caps` page** that runs it against the live catalog. *(3 h)*
7. **The adapter refactor** — one core, `LogSource`/`ChainReader`/`CatalogSource`/`Clock`. *(4 h)*
8. **`/docs/format` + a 20-line log writer package.** *(2 h)*
9. **`/verify` as an interactive trace**, not a JSON endpoint. *(2 h)*
10. **`/docs/security-model`** — what you don't prove. *(1 h)*
11. **Fix the DNS-rebinding window** in `net.ts`. *(1 h)*

**Then the money:**

12. **Price the product off the number you just built.** "Spend control that tells you what your
    control is costing you." One payer (the operator who sets the cap), one number (a per-agent
    monthly fee with the cap-calibration as the value), one sentence. Do this *after* step 5 so the
    number you quote is computed, not asserted.

---

## 9. The one-line version

Capsule is not "a cap for agents" — that lane has ten entries and your own `docs/BRIEF.md` says so.

**Capsule is the only thing that can tell you what a spending limit cost you**, because it is the
only thing that records what an agent was *refused*, at the *real price*, against the *budget the
user signed with a passkey* — and it can prove the payments on chain, and it ran the same task
twice with one variable changed to prove the cap was the cause.

Everything else in this document is in service of making that one sentence true, checkable, and
reachable by someone who is not you.
