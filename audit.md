# Audit — `unifyWeb3/capsule` (SERV Hackathon Ed. 02, Kite track)

**Auditor note (read-only).** Both repos were cloned fresh under `/tmp/opencode/audit` and audited
read-only. Nothing was pushed, no PRs were opened, and the audited repository was not modified. No
wallet was connected and no payment flow was executed against either demo. The only writes were
temporary files inside the `/tmp` clones (a scratch `.env` used to invoke `npm run verify`).

---

**Judging target** (`openserv.ai/hackathon-2`, fetched during this audit): criteria are
**creativity, user readiness, revenue potential** — no weights published. Pool $5,000:
`track_winner × 2`, `best_overall_build`, `special_mention`, all TBA. Deadline
**Nov 15 2026 23:59 UTC** (at audit time ~3.5 days remained, not 24h). Gates: SERV Reasoning must be
in the build; Kite track = "verifiable identity and spending limits you control". Submission needs
public repo + demo link/video + write-up + an X post tagging `@openservai`.

---

## 1. Verdict

**Product:** a record of what a spending agent did with your money — purchases *and refusals* —
where the cap is enforced by a passkey-approved Kite Passport session held outside the code, and
the proof page re-reads Base at request time.

**How it would score (my estimate, criteria unweighted):** creativity **6/10** (right axis, crowded
lane), user readiness **6/10** (a judge can *read* it but not *run* it), revenue potential **3/10**
(no customer, and your own service can't be paid, so there is no monetisation path at all). On the
repo's own weighted benchmark (`docs/EVENT-RULES.md:57`): **~58/100** — impact 14/30, tech execution
13/20, innovation 7/15, demo & evidence 9/15, product/UX 7/10, sponsor tech 8/10. Both gates pass.

**Single biggest thing holding it back:** the README's headline "recorded run" table is a
**superseded run** that contradicts `docs/receipts.json`, `docs/decision-log.jsonl` and your own live
`/proof.json`. Your whole pitch is "we don't hide anything, you can check"; the first thing a judge
checks is the one thing that fails the check.

---

## 2. What you got right (evidence only)

- **The enforcement thesis is real and correctly located.** `src/kpass.ts` wraps the `kpass` CLI;
  `src/agent.ts` has no cap logic — the limit lives in the Passport backend.
  `docs/EVENT-RULES.md:130` identifies Tender's self-implemented `BudgetGuard` as the thing to beat,
  and you beat it.
- **The refusals are genuine Passport decisions.** `docs/decision-log.jsonl:3-4` carries
  `session_rule_exceeded` ("payment amount exceeds max_amount_per_tx") and
  `session_total_exceeded` — the Passport's own codes (`src/kpass.ts:60-66`).
- **The attestation is verifiable and I verified it independently.** `docs/receipts.json` signature
  recovers to `0x5512caEe289ef639CD3181487F93920C5F544868`, which is exactly what Kite publishes for
  `did:kite:ind-akoladefatoki108:capsule-agent` at
  `passport.prod.gokite.ai/v1/agents/<did>/signingKeys` (`settlement_address`). Signed head
  `0x6ab76d14…` == log head == receipts head.
- **The payments are real.** I re-read Base independently: `0xf222835b…` (block 56,361,241) and
  `0x92031083…` (block 56,361,347), each a 1000-unit USDC transfer, status `0x1`.
- **`/proof.json` re-derives from the chain at request time**, not from a cached copy
  (`src/app.ts:105-133`, `src/proof.ts:158-236`). I fetched it: `status: verified`,
  `all_payments_verified_on_chain: true`.
- **The front-end is genuinely good.** `public/index.html` — dark/light, `escape()` on every
  interpolation, skip link, `aria-*`, empty *and* error states that distinguish "no run" from
  "no spend".
- **Honest limitations section.** `README.md:161-177` states the tiny caps, that your own service
  earned nothing, that settlement is Base not Kite chain, and one task/one agent.
- **No secrets in history.** `git log --all -p` scan for keys/64-hex secrets: clean. `.gitignore`
  covers `.env`, `.kite-passport/`, `.secrets/`. `npm audit --omit=dev`: **0 vulnerabilities**.
- **Tests pass, types clean.** `npm test` → 19/19. `npm run typecheck` → clean.

---

## 3. Bugs and risks

| Sev | File:line | What breaks | How to fix |
|---|---|---|---|
| **Critical** | `README.md:21-35` | The run table (5 attempts, 3 refusals, `0x591ba92f…`/`0xaeb58efc…`) is commit `f662b70`'s run. `docs/receipts.json` (4 attempts, 2 refusals, `0xf222835b…`/`0x920310837…`), `docs/decision-log.jsonl` and the live `/proof.json` are commit `b1fbcc5`'s run. Both runs are real on-chain (I verified the old hashes at Base blocks 56,178,958/56,179,047) — the README is simply stale. A judge who cross-checks sees a contradiction and discounts the evidence discipline. | Generate the table from `docs/receipts.json`; delete the hand-typed hashes and point at `/proof.json` instead. Add a `npm run readme-table` script so it can't drift again. |
| **High** | `package.json:19` (`verify`), `:13` (`demo`), `:14` (`claims`) | `--env-file=.env` **aborts** when `.env` is absent: measured `node: .env: not found`, exit 1, before any check runs. `docs/ACCOUNT-SETUP.md:11` claims all scripts use `--env-file-if-exists` — only `dev`/`start` do. | Use `--env-file-if-exists=.env` on all three, or `touch .env` in the README. |
| **High** | `scripts/verify.ts:99` → `src/attest.ts:77-89` | `fetchPublishedKeys` shells out to `ksearch`. On a machine without the Kite CLI it throws → recorded as FAIL → `npm run verify` **exits 1**. Measured: `13/14 checks passed — 1 failed`. The crown-jewel check (signature vs Kite's published key) is the only one needing an undocumented binary the README never mentions. | Replace with a plain HTTPS read of `passport.prod.gokite.ai/v1/agents/<did>/signingKeys` — Tare already does exactly this (`src/identity.js:79-86`). Or add the Kite CLI install to the README and treat a missing CLI as a skip, not a failure. |
| **High** | `README.md:122-130` | "Run it yourself" does `cp .env.example .env; npm start` → measured crash: `Error: PAY_TO is required: the Kite chain address that receives the payments` (`src/app.ts:41-45`). Also `.env.example:8` says `SETTLEMENT_CHAIN=kite` while the recorded run was Base (`docs/receipts.json:17`). | Ship a working `.env.example` with a placeholder `PAY_TO` and `SETTLEMENT_CHAIN=base`; make `readConfig()` print an actionable message instead of throwing raw. |
| **Medium** | `README.md:128` | "npm test # 11 tests" — measured **19** (log 8, kite 6, serv 5). | Say 19. |
| **Medium** | `README.md:88` | Claims receipts carry a "running total" per line. `docs/receipts.json` has `spent_total_after: null` on **all four** steps (`scripts/rebuild-receipts.ts:59` hardcodes null). | Compute the running total in `rebuild-receipts.ts` from the log's prices, or drop the claim. |
| **Medium** | `docs/CLAIMS.md:10` | "Amount the agent actually spent — source of truth: **the Passport's own usage.spent_total**". It isn't: `scripts/rebuild-receipts.ts:65-69` sums the log's price strings. | Fix the attribution, or make `run-demo.ts:131` the source and record which path wrote the file. |
| **Medium** | `docs/BRIEF.md:98` vs `docs/SUBMISSION.md:67-69` | One says `npm run verify` runs **13** checks, the other **fifteen**. Measured: 14 without the Kite CLI (exit 1), 15 with it. | One number, from `verify.ts`'s own counter. |
| **Medium** | `src/agent.ts:397-398` | The live decision parser is a bare `JSON.parse(content)` — no fence stripping. The *tested* parser (`src/serv.ts:211-227`) strips ```` ``` ```` but is **never used by the agent**. A fenced reply aborts the run with a raw `SyntaxError`. | One parser, used by both. |
| **Medium** | `src/agent.ts:112-119` | `decide()` is not wrapped in try/catch (the final answer at `:247-267` is). A SERV error on step 2 aborts before `receipts.json` is written — money already spent survives only in the decision log. | Wrap it; record a `failed` step; write the receipts in a `finally`. |
| **Medium** | `src/agent.ts:284-302` | `resolve()` fuzzy-falls-back from a hallucinated id to an endpoint by path/suffix (`byPath`, `bySuffix`, `byServicePath`). A mangled id can be paid for the **wrong** endpoint. | Exact `id` only for purchases; keep fuzzy matching for display. |
| **Medium** | `src/proof.ts:201-230` | `verifyStep` collects **every** `Transfer` log in the tx without filtering by the USDC contract address, and never checks the sender. The comment at `:154-157` admits the recipient isn't compared. So `matches_receipt` proves "some transfer of that size happened", not "our wallet paid this merchant". The README's "the sender (your Passport wallet)" is reported, never asserted. | Filter by `chain.assetAddress`; assert `from == agent wallet`; compare the recipient against the merchant's `pay_to` from the x402 challenge. |
| **Medium** | `scripts/rebuild-receipts.ts:91` | `task: process.env.DEMO_TASK ?? ""` — running `npm run receipts` without `DEMO_TASK` **blanks the task** in the artifact. | Fall back to the task in the log, or preserve the existing receipts. |
| **Medium** | `scripts/rebuild-receipts.ts:32` + `src/kpass.ts:155-163` | The receipts' `session_id` and caps come from `kpass session list`'s **first** session, not from the session that produced the log — the log records no session id. Create a second session and the receipts bind the wrong caps to the run. | Write `session_id` into each log record and read it back. |
| **Medium** | `src/seller.ts:70-71` | `/v1/history` returns `return_7d_pct` and `return_30d_pct` from the **same** 30-day series. The "7-day return" is the 30-day return. | Compute two windows, or rename the field. |
| **Medium** | `src/catalog.ts:134-183` | Scout's `/v1/history`, `/v1/deep`, `/v1/briefing` return a **seeded xorshift random walk** as "trend statistics"; `sentiment_score` and `stance` derive from it. Only `series_source: "derived"` discloses it. A judge who pays $0.05 gets a synthetic series labelled like a real one. | Pull real history, or rename the endpoints and fields to say "synthetic". |
| **Medium** | `src/catalog.ts:92-127` | CoinGecko is called keyless; a 429 makes `fetchSpot` return nulls — but the x402 middleware has **already charged**. | Pre-check the spot on a free route before the paid route, or cache. |
| **Medium** | `docs/menu.json` | All 29 endpoints have `probe_status: "unknown"`. `README.md:104-105` says "A judge can pay any of them directly" — unverified for 26 of 29. | Probe them, or drop the sentence. |
| **Medium** | `src/menu.ts:46-50` | `affordable()` is dead code. The agent is **never filtered by budget in code** — the total budget is enforced by the model reading `budget_remaining_usd` (`src/agent.ts:333`). That is "the agent caps itself" on the *sequencing* axis, which is the exact thing your README says you're rejecting. | Filter the menu in code; keep the model's choice within it. |
| **Medium** | `src/serv.ts:37-46`, `:57-137`, `:204-207` | `SYSTEM_PROMPT`, `ServClient.decide` and `ServClient.parseChoice` are **dead**. The agent uses its own prompt and parser in `agent.ts`. `test/serv.test.ts` tests the dead path. | Delete, or make the agent use them. |
| **Medium** | repo root (no `vercel.json`) | The deployment isn't reproducible: `tsconfig.json:13` includes `"api/**/*.ts"` but there is no `api/` dir and no `vercel.json`. A judge can't redeploy. | Add `vercel.json` with the rewrite to `src/app.ts`. |
| **Medium** | `public/index.html:770` | `c.tx_hash.slice(0,12)` throws when a paid step has no tx hash — exactly the shape of `docs/receipts.run1.json` (3 paid, all null) → the entire page drops into "The proof endpoint did not answer". | Guard it. |
| **Medium** | no test files for `agent.ts`, `app.ts`, `proof.ts`, `attest.ts` | The crown jewels — the agent loop, `verifyStep`, `verifyAttestation` — have **zero** unit tests. Tare has 204 covering its equivalents. | Add ~15 tests: parser fencing, `resolve()` collisions, `verifyStep` with a foreign token/sender, `verifyAttestation` tamper cases. |
| **Low** | `src/agent.ts:158` | `randomUUID()` per call as the idempotency key — a retry after a timeout would pay twice. No retry exists today, so it's latent. | Derive the key from origin+request_id like Tare does (`src/buy.js:19-21`). |
| **Low** | `src/agent.ts:225-241`, `scripts/rebuild-receipts.ts:46` | Tx hashes are matched back to steps **by URL only** against the account-wide activity log. Buying the same URL in another session can pick up the wrong hash. | Match on URL + session + amount. |
| **Low** | `scripts/run-demo.ts:71`, `:103-104` | Hardcoded DID, `agent_id` and address. | Read from the CLI. |
| **Low** | `src/proof.ts:239-242` vs `src/kite.ts:117-120` | Two implementations of dollars→base-units; the first doesn't reject >6 decimals (`kite.ts:78-82` does). | One function. |
| **Low** | `docs/seller.json:5` | `"network": "kite"` — settlement was Base. | Fix. |
| **Low** | `docs/SUBMISSION.md:4`, `:29-36` | The submission pack is written as notes *to you* ("You publish the X posts — I do not", "the user's call"). Fine as internal notes, wrong as a submitted artifact. | Rewrite for the judge. |

---

## 4. Claims vs reality

| Claim | Reality | Source |
|---|---|---|
| "It made five attempts… Three purchases were refused" | **Stale.** 4 attempts, 2 refusals in every current artifact. | `README.md:23,33-35` vs `docs/receipts.json:135-140`, `docs/decision-log.jsonl` (4 records) |
| "paid — `0x591ba92f…` / `0xaeb58efc…`" | Real transactions, but from the **superseded** run. Current run: `0xf222835b…` / `0x920310837…`. | `README.md:27-28` vs `docs/receipts.json:87,101` |
| "npm test # 11 tests" | 19 tests. | `README.md:128` vs measured |
| "`npm run verify` — 13 checks… exit 0" | 14 checks without the Kite CLI, **exit 1**; 15 with it. | `docs/BRIEF.md:98` vs measured |
| "fifteen checks" | 15 only with `ksearch` installed. | `docs/SUBMISSION.md:67-69` |
| "one line per attempt: …running total" | `spent_total_after: null` on all lines. | `README.md:90` vs `docs/receipts.json` |
| "Amount the agent actually spent — the Passport's own usage.spent_total" | Sum of log price strings. | `docs/CLAIMS.md:10` vs `scripts/rebuild-receipts.ts:65-69` |
| "The limit is enforced outside the process that wants to spend" | **True for the cap.** The *total budget* the model plans against is read from the session and supplied to the model in the prompt — the sequencing is still agent-side. | `src/agent.ts:318-334` |
| "A judge can pay any of them directly with their own Passport" | Unverified: all 29 `probe_status: unknown`. | `README.md:104-105`, `docs/menu.json` |
| "the deployment is the tested artifact" | True, but the deployed artifact is not reproducible from the repo (no `vercel.json`). | `docs/BRIEF.md:98` |
| "Nothing in this repository can raise that limit" | **Verified true.** | `src/agent.ts`, `src/kpass.ts` |
| "The record is tamper-evident" | True against *third-party* edits; the log is a local file the owner can rewrite and re-sign (`DecisionLog.rewrite` + `signLog`). | `src/log.ts:133-146`, `src/attest.ts:107-138` |
| "Every purchase your agent made, every one it was refused" | Purchases are chain-verified. **Refusals are not** — `/proof.json` only chain-checks paid steps (`src/app.ts:116-117`); refusals exist only inside the signed local log. | `src/app.ts:115-132` |

---

## 5. What you should have done differently, ranked by impact on winning

### 1. Make the *refusal* — not the purchase — the externally provable artifact

*Why:* Your differentiator is that a third party can check your evidence without trusting you. Today
only the **payments** are externally checkable; the refusals — which `README.md:39` calls "the
interesting one" — are signed by a key whose holder also controls the file. A judge's hardest
question ("how do I know the Passport really refused that?") has no answer.

*How:* Attach the refusal to something public. Options: (a) post the session's delegation /
delegation-id and the Passport's own audit id so a judge can query the Passport; (b) record the
refusal **on-chain** — write a 0-byte attestation to your Scout contract or a tiny `Capsule`
contract with the `(session_id, error_code, amount, timestamp)` tuple, so the refusal has a
transaction hash exactly like a purchase; (c) publish the log head + record hashes to a public
IPFS/Arweave pin and cite the CID in the README. (b) costs ~15 minutes of viem code and produces
*four* chain-checkable rows instead of two — a symmetric proof page: "4 attempts, 4 on-chain
anchors, 2 settled, 2 refused by the Passport."

*Effort:* 3–5 hours.

*Judges care* because "every track needs SERV Reasoning" + "the limit is somebody else's" is your
whole thesis, and this is the only place the thesis is currently self-asserted.

### 2. Ship the contrast run

*Why:* `docs/SUBMISSION.md:120-121` already names it as the missing thing: the same task under a
larger limit, showing the purchase that was refused actually going through. Right now the artifact
proves a cap held; it does not prove the cap was the *only* thing stopping a good answer. That is the
difference between "we spent $0.002" and "we spent $0.002 because we were told to stop, and we know
exactly what we would have bought."

*How:* One `kpass session create --max-amount-per-tx 0.06 --max-total-amount 0.1`, one
`npm run demo` with `DEMO_FACTS` set so the trend fact is first. It should cost about $0.06 on Base.
Two receipts side by side: *attempt 3 refused at $0.05; under a larger cap the same attempt
settled.*

*Judges care* because "user readiness" and "revenue potential" both need a sense of the product
working at a realistic scale, and $0.002 caps read as a toy.

*Effort:* 1–2 hours plus a wallet top-up.

*Cost note:* this needs a second approval. If it isn't affordable, the alternative is a **replay** —
re-run the same task with the Passport's refusal codes captured, at a larger budget, on a different
day.

### 3. Close the "no customer, no revenue" gap with a pricing experiment you can show

*Why:* `docs/BRIEF.md:79` scores payment evidence at **level 5 (our own belief)** and admits it's the
weakest gate. "Revenue potential" is a third of the judging criteria and you are at ~3/10. Also,
`README.md:113-120` says your own Scout **cannot be paid** because the host isn't allowlisted — so
there is literally no monetisation path in the build, which makes the revenue score unwinnable
as-is.

*How (pick one, cheapest first):* (a) Get the host allowlisted — the catalog record says *"Added via
GOK-557 (host_not_allowlisted review)"*, so it's a **review in progress**, not a rejection. Ask Kite
to expedite it; that single action turns Scout into a payable, revenue-generating service and lets
you demo buying from yourself. (b) While waiting, publish the service on the OpenServ x402
marketplace (`platform.openserv.ai/x402-services`, 3,036 agents already listed) — that gives a real
paid endpoint with no allowlist gate. (c) If neither, at minimum price the product: one line, one
number, one payer — "operator of a spending agent, $19/agent/month, capped spend share 2%" — and say
it is a hypothesis.

*Effort:* (a) 30 min of waiting + one email; (b) 2 hours; (c) 15 minutes.

*Judges care* because the criterion is literally "revenue potential", and every comparable entry in
the field is mechanism-demo-with-no-buyer (your own `docs/BRIEF.md:38-41` says so) — the field is
weakest exactly here, so this is your cheapest available edge.

### 4. Make it judge-runnable in 5 minutes without a wallet

*Why:* The single most common judge motion is *clone → run → read output*. Today `npm run verify`
fails on a clean clone (missing `ksearch`), `npm start` crashes with the shipped `.env.example`, and
there's no `vercel.json`.

*How:* add `vercel.json`; switch all `--env-file` to `--env-file-if-exists`; make the attestation
check work over plain HTTPS (Tare's way); print a clear "paste this" summary at the end of
`npm run verify`; add a `npm run judge` that runs everything a judge needs in one command and prints
a short report.

*Effort:* 2–3 hours.

*Judges care* because "user readiness" is a third of the rubric and the current failure is
embarrassing rather than substantive.

### 5. Ship a 90-second demo video

*Why:* The form wants "a demo link or video"; the field norm is a video (`docs/EVENT-RULES.md:128` —
61.8% of entries). Tare's is 1:50 with voice-over and subtitles and it's the first thing in their
README. You have a better story than most — **the refusal is the demo** — and it is entirely visual:
a 402 challenge, a refusal, a substitution.

*How:* screen-record the live console; no voice needed (Tare's README notes the voice is local
Kokoro, and Tare's `video/` dir shows the whole pipeline is scriptable).

*Effort:* 1–2 hours if scripted carefully, 4+ if improvised.

*Judges care* because it's the highest-leverage 2 hours you can spend on "readiness" and "demo".

### 6. Pick the owner axis and build one workflow on it

*Why:* `docs/BRIEF.md:56-61` is the strongest analysis in the repo — every entry in the field makes
the *agent* the subject; nobody builds the record for the *owner of the money*. But the repo doesn't
implement it: there is no chargeback view, no auditor export, no "what did I buy and what did I want
to buy" for a customer.

*How:* one screen: "Give this to your customer." A shareable, read-only record of the run with the
chain proof inline — the same `/proof.json` you already have, plus a plain-language summary and a
"this is what your agent was refused and why" line. That is ~1 day on top of what exists, and it's
the only way the BRIEF's claim becomes a product rather than a positioning statement.

*Effort:* 4–8 hours.

*Judges care* because "creativity" is where the money is, and your analysis says this axis is empty.

---

## 6. Standout moves (specific, buildable, tied to the criteria)

### A. The refusal receipt as a first-class, on-chain object

Make the *refusal* a settlement-shaped artifact: a transaction (your own contract, or a "Capsule
receipt" service) that records `(passport_session_id, endpoint, price, error_code, timestamp,
decision_log_head)`. The proof page then shows **four** chain-anchored attempts: two settled (money
moved) and two refused (money didn't move, decided by the Passport). This inverts the field's default
idiom — every competitor proves what it *paid for*; you'd prove what it was *prevented from paying
for*, with the same cryptographic strength. Tied to: creativity (a new artifact type), user
readiness (one page showing the whole story), sponsor tech (the Passport's error code is in the
chain). *Effort: 4–6 hours.* This is the one I'd build first.

### B. The Passport-wallet ⇄ DID binding proof

Right now two different addresses appear in your artifact and nothing ties them together: the
*spending* wallet `0x1724508463d67b77882375931a46a351c0b69905` (on-chain `from`, verified by me on
both payments) and the *identity* address `0x5512caEe289ef639CD3181487F93920C5F544868` (the DID's
published key, which signs the log). A judge who notices this asks "whose money was that?" and you
currently have no on-chain answer. Prove the binding: show the Passport's own delegation record
naming the settlement wallet, publish it, and add it to `/proof.json` as a third independent anchor
— *refusals decided by the Passport*, *payments signed by this wallet*, *that wallet bound to this
DID by Kite*. That's a three-anchor chain nobody else in the field has. Tied to: the Kite gate
("verifiable identity"), technical execution, credibility. *Effort: 2–3 hours* — you likely need one
`kpass session status --output json` or `kpass agent status` to capture the delegation's settlement
address.

### C. "What the cap would have bought" — the counterfactual budget report

Your recorded run refused a $0.05 Google Trends endpoint and then a $0.001 funding-rates endpoint,
and the agent covered 2 of 5 facts and **named the other three**. Nobody else in the field publishes
the *counterfactual*: what the answer would have been had the cap been $0.06, which endpoints would
have filled which missing facts, and what each would have cost. Make the proof page compute this
from the same menu: for each missing fact, the cheapest endpoint that covers it and its price, so the
reader sees "$0.05 of trend data was blocked by a $0.002 cap — the answer is 40% complete and here is
exactly what the remaining 60% costs." That turns your weakest recorded fact ("covered 2 of 5") into
your strongest argument: **it quantifies the cost of the limit**. Tied to: creativity, user readiness
(the record now explains itself), revenue (it shows the value at stake per spend). *Effort: 3–4
hours* — you already have the menu, the facts, and the chain.

---

## 7. If you have 24 hours (you actually have ~72)

1. **Fix the README table.** Regenerate from `docs/receipts.json`; delete hand-typed hashes.
   *(30 min — highest ROI in the whole list.)*
2. **Make `npm run verify` pass on a clean clone.** `--env-file-if-exists`, replace `ksearch` with the
   HTTPS key endpoint, treat a missing CLI as a skip. Re-measure and state the real number. *(1.5 h)*
3. **Fix the run path.** Working `.env.example` (`PAY_TO` placeholder, `SETTLEMENT_CHAIN=base`),
   `vercel.json`, correct test count, `spent_total_after`, `CLAIMS.md` source attribution,
   BRIEF/SUBMISSION check-count agreement. *(1.5 h)*
4. **Record the contrast run** under a larger cap and put both receipts side by side in the README.
   *(2 h + approval)*
5. **Write the "not true" section** — one screen: what's real, what's derived, what's self-asserted.
   Model it on `docs/EVENT-RULES.md:133`'s "winning README shapes" note (EXHIBIT A's format: every
   fact carries a quote; code checks each quote). *(1 h)*
6. **Publish the X post** with both drafts in `docs/SUBMISSION.md:71-110`, tag `@openservai`, attach a
   screenshot of the refusal. *(30 min — this is a hard gate on the form.)*
7. **Demo video, 90 seconds.** Record the refusal → substitution → "named 3 facts as unchecked" story.
   *(2 h)*
8. **Ask Kite to expedite GOK-557.** One message. If it lands, add "our own service is now payable and
   the agent bought from it" — that is a new demo and a new revenue line. *(30 min, plus waiting)*

With the extra ~48 hours beyond that: build **A** (refusal receipts on-chain) and **C** (counterfactual
budget report). Those two turn a good artifact into a memorable one.

---

## 8. What I could not verify, and why

- **Whether an X post exists.** `docs/SUBMISSION.md:24` says "*paste after posting*". Required form
  field; if it isn't up, you may be ineligible.
- **Whether data collection is enabled** at `console.openserv.ai/settings/organization`.
  `docs/SUBMISSION.md:124` calls it "an eligibility gate, not a detail". Needs your account.
- **The live eval numbers.** Not applicable — Capsule has no eval, which is itself a gap.
- **Whether the recorded run is reproducible.** Needs a Kite account, a passkey, and a funded Base
  wallet. I did not connect a wallet or spend anything. **I did not verify the agent can still buy
  from `agent402.tools` / `x402.ottoai.services` today.**
- **Whether `agent402.tools` / `x402.ottoai.services` / `google-trends.use.x402atlas.com` are still in
  the Kite catalog** — I read `docs/menu.json` from 2026-11-11, not the live catalog.
- **The KYC state** (`README.md:177` says pending review).
- **Whether the deployed app matches the repo HEAD.** The deployed `/proof.json` matches the committed
  receipts exactly, so yes for the receipts — but there's no `vercel.json` to confirm the *code*
  matches.
- **The SERV model name `gpt-5.4-mini`** (`src/agent.ts:316`). I have no SERV key, so I could not
  confirm this model exists on `inference-api.openserv.ai`. If it's wrong, `npm run demo` 400s. Tare
  uses `gpt-5.4-mini-serv-multipath` (`src/prompt.js:5`) — worth checking yours is a valid SERV model
  id.
- **My scoring is my estimate.** The criteria are unweighted and the prize breakdown is TBA.

---

## 9. Benchmark: Capsule vs Tare

### Method Tare uses that Capsule should adopt

**"Make the model read, never decide, and publish the measurement."**

1. **A decision the model is not allowed to make.** Tare's `src/check.js` is pure — no I/O, no model —
   and computes the verdict; SERV only emits four typed claims (`src/serv.js:32-57`). Capsule's
   equivalent — the model picks the endpoint, the Passport caps it — is weaker, because the
   *sequencing* is still the model (see `src/agent.ts:333`). Move one decision out of the model: let
   code rank the menu by price-per-fact-covered and let the model only choose within a code-computed
   shortlist.
2. **Measured results, not claims.** Tare published `9/9 accuracy · 6/6 safety` with the eval script
   committed (`scripts/serv_eval.mjs`), the exact prompt hashes in the README, and the prompt guard
   *deliberately disabled* with the reason measured. Capsule has **no eval at all**. A 20-line eval
   that shows the agent picks a cheaper endpoint when the budget is lower — with the output pasted
   into the README — would be decisive for "user readiness" and "technical execution".
3. **Honest limitations that cut against you.** Tare's README:112-128 admits Passport returned
   `payment_target_forbidden` and that the run used a different rail. Capsule's README:161-177 does
   the same and that is *already* a strength — go further: name the one thing your evidence does
   **not** prove (refusals aren't chain-verified).
4. **A before/after demo story.** Tare's is literally three lines: A disputed → A stopped → B
   verified. Your equivalent: cap $0.002 → cap $0.06, same task. That's standalone move #2 above.
5. **A reviewer command that moves no money.** Tare's README:26 says "*SERV and the payment rail are
   faked, no network*" — a judge can run `npm test` safely. Capsule's `npm test` is also safe (19/19,
   no network) — but the *headline* command (`npm run verify`) hits the chain and needs the Kite CLI.
   Split it: `npm run verify:offline` (no network, no keys) + `npm run verify:live`.
6. **A third-party-readable artifact.** Tare publishes `records.json` signed EIP-191, with a
   `/check` lookup page and a `did:kite:` pin that resolves against Kite's live key set
   (`src/identity.js:79-86, 96-117`). Capsule's analogue — a shareable record *other agents can
   verify* — is your proof page, but it has no signature over the *page*, only over the log head.

### What Tare lacks that Capsule could use as an edge

- **Tare's caps are its own.** `src/x402direct.js:24-45` — 0.05/payment, 1 total, enforced by Tare's
  ledger. Tare's README:121 says so plainly: *"Caps: enforced by Tare's own ledger… not by a
  Passport session."* That is precisely the pattern Capsule's `docs/BRIEF.md:56-61` calls table
  stakes. **A project that proves the cap is enforced by a key the user holds, in a run where the cap
  actually bit, is a gap Tare cannot close without a Kite allowlist it says it does not have
  (README:112-116).** That is Capsule's strongest possible pitch — make it explicit and quantified,
  not implied.
- **Tare never settles on Kite mainnet** — testnet only, pieUSD, no real value. Capsule settled **real
  USDC on Base mainnet** with real tx hashes a judge can look up on Basescan. That is a different
  class of evidence, and Tare's own post concedes it.
- **Tare's published run has no Passport payment** — *"No Passport payment hash exists for this run,
  and none is shown"* (README:128). Capsule's run *does* have Passport refusals with Passport error
  codes. Use that.
- **Tare's fee rail is untested commercially** — its feed lookups cost 0.001 testnet pieUSD. Nothing
  there is revenue.
- **Tare has no Kite-chain settlement and no owner-side workflow.** Capsule's BRIEF's "the owner" axis
  is unoccupied by Tare.

---

# STEP 1B — Tare, claim by claim

Repo: `github.com/Ritapossible/Tare` (cloned read-only). Demo: `tare-agent.vercel.app` (all pages
HTTP 200). I did **not** run any payment flow, connect a wallet, or spend anything.

| Claim in the X post | Verdict | Evidence |
|---|---|---|
| "SERV reads; code decides. The model has no verdict to give" | **Confirmed** | `src/check.js` is pure ("No I/O, no model, no network", line 1); the verdict is computed at `src/check.js:86-89`. `src/serv.js:32-57` `parseClaims` drops every key except the five typed claims; the prompt says *"Do not include a verdict"* (`src/prompt.js:21`). Only `body.prose` is sent to SERV (`src/prompt.js:64-76`); rows never leave Tare (`src/buy.js:171-186`). |
| "code now drops any claim the seller's own text doesn't support (a count must be a number the seller actually states, not 'up to 20' or '10,000+')" | **Confirmed** | `src/serv.js:71` `BOUND_BEFORE` matches "up to\|at most\|max\|no more than\|≤\|~…"; `:99` sets `bounded`; `:174-177` `ground()` drops `claimed_count` unless an **unbounded exact** stated number matches. `+` suffix handled at `:99` (`after === "+"`). `statedWindows` (`:142-164`) does the same for time windows. Tests: `test/grounding.test.js`, `test/serv.test.js`. |
| "spending caps (0.05 per payment, 1 pieUSD total) are enforced in code" | **Confirmed** | `src/x402direct.js:24-27` `DEFAULT_CAPS` (0.05e18 / 1e18, 18 decimals); `:30-45` `checkRequirement` rejects scheme/network/asset/amount/caps; `:60-64` `onBeforePaymentCreation` aborts signing; `:68-71` `onAfterPaymentCreation` charges the ledger at signing time, so a settled-but-errored call still counts. The ledger is lifetime — `src/store.js:132-137` keeps `direct_spent_units` across `reset()`. The x402 client's own `spendControls` also cap it (`src/x402direct.js:54-56`). **Caveat, and Tare states it plainly:** these are *Tare's own* caps, not a Passport session (README:121). |
| "a broken promise is a dispute, and the seller is held. the next buy stops before any payment" | **Confirmed** | `src/buy.js:217-218` `store.block(origin, …)` on `dispute`/`unverifiable`; `src/buy.js:79-82` returns `status: "refused"` **before** `kpass.execute` at `:143`. `unverifiable` also holds (`:217`). There's also an unresolved-pending-payment refusal (`:86-89`). |
| "every check becomes a public seller record with evidence: both promises word for word, the settlement hash, body hash and prompt hash" | **Confirmed** | `src/records.js:13-33` `evidence()` carries `promise` (delivery note), `advertised` (the 402 ad), `tx_hash`, `body_sha256`, `prompt_sha256`. The live `https://tare-agent.vercel.app/records.json` is **byte-identical** to the committed `web/records.json`, contains both hashes, and carries an EIP-191 signature (`scheme: tare-feed-eip191-sha256-v1`, signer `0x9C81aD8f2B0e3Ff97604F4a3CFCbd6771Df89485`, `did: null`). |
| "records are signed. other agents pin the publisher by address or Kite DID, checked against Kite Passport's public key set" | **Confirmed** | `src/identity.js:41-47` `signFeed` (EIP-191 over a sha256 of canonical JSON); `:50-64` `verifyFeedSignature` re-derives the digest and rejects any post-signing edit; `:96-117` `verifyFeedIdentity` supports `url#0x…` and `url#did:kite:…`; `:79-86` `kiteSigningAddresses` reads `passport.prod.gokite.ai/v1/agents/<did>/signingKeys` and derives addresses from Kite's own public key. Pin enforcement in `src/feeds.js:101-103`. |
| "live eval: 9/9 accuracy on honest texts, 6/6 safe on injection attempts" | **Partly true — the script is real and matches the numbers; the *result* is not a committed artifact** | `scripts/serv_eval.mjs:23-33` has exactly 9 benign cases and `:35-42` exactly 6 adversarial cases, with the pass criteria matching the README's description (accuracy: exact claim match; safety: verdict ≠ "clean"). The `9/9 · 6/6` **output is not committed** — it lives only in `README.md:80-81` and `MEMORY.md`, dated 10 Nov 2026, and re-running it needs a SERV key. Same class of issue as Capsule's README table, but here the *procedure* is reproducible and the numbers are internally consistent, whereas Capsule's table contradicts its artifacts. |
| "I measured SERV's Prompt Guard and kept it off on purpose" | **Confirmed** | `src/serv.js:256-264`: `DEFAULT_SERV_TOOLS = "disable_content_filter"`, `prompt_guard` deliberately not default, with the exact reasoning ("turns an injection attempt into a SERV failure (paid_unchecked, seller not held)"). |
| "SERV also explains each dispute in plain English… code rejects it unless every number is in the evidence, and it never changes the verdict" | **Confirmed** | `src/explain.js:41-55` `explanationFacts` builds facts from code-measured numbers only; `:64-89` `checkExplanation` rejects any number not in the facts, rejects accusatory language (`:29`,`:82`), enforces ≤600 chars; `:93-109` `explainReceipt` never touches the verdict — the verdict is already set at `src/buy.js:208-215` before `explain` runs (`:221-229`). |
| "the Kite Passport limitation they admit (paid with a capped testnet key via Pieverse)" | **Confirmed, and verified on-chain** | README:112-128 states it plainly. `src/x402direct.js:30-45` refuses to sign anything but testnet `eip155:2368` pieUSD. I verified all three hashes on `rpc-testnet.gokite.ai`: `0xfe1fb5d2…` (block 22,043,945), `0x94c3e5f0…` (22,043,946), `0x217a85b7…` (22,043,913) — each a 1,000,000,000,000,000-wei (0.001 pieUSD) transfer from `0x7979989a…` to `0x9Ef47eA8…`, status `0x1`. |
| "every payment is real and settled on Kite testnet" | **Confirmed for the two published buys** | Same three on-chain receipts above; the published `records.json` hashes match. |
| "spending policies decide whether to pay" (i.e. Tare is not the policy layer) | **Confirmed** | Tare is the *verification* layer; `README.md:5` says "Spending policies decide whether an agent may pay. **Tare checks what it got.**" |

**Same hackathon, same track.** Tare's README:14 says *"Built for: SERV Hackathon 02, Kite track"* —
identical to Capsule (`README.md:15`). Same three criteria, same $5,000 pool, same Nov 15 deadline. The
comparison is therefore apples-to-apples. **One caveat:** the X post I was given renders "serv
hackathon 2" and the repo says "SERV Hackathon 02" — same event, confirmed by the Kite track, the
SERV Reasoning requirement, the Kite Passport, and the x402 rail appearing on both sides.

## Comparison table

| | **Capsule** | **Tare** |
|---|---|---|
| **Problem clarity** | Clear and correctly located: *the limit must not live in the code that wants to spend*. One-sentence claim, and the repo's own field analysis (`docs/BRIEF.md:43-68`) is better than most entries'. | Clearer still, and more visceral: **"The label is not the delivery."** *Pay per record? Then someone has to count the records.* A single sentence, a single mechanism, a single number (1,240 vs 860). |
| **How sponsor tech is used** | **SERV** = the decision layer (`src/agent.ts:370`, strict JSON schema). **Kite Passport** = the actual cap, refusals carry its own error codes, and the agent is *not* told the per-tx ceiling. Strong, genuinely non-trivial use of both. | **SERV** = reads the seller's text into typed claims and writes the dispute explanation — deliberately never the verdict. **Kite Passport** = *not* in the money path (allowlist blocked it); used for the agent directory and key pinning instead. **Kite's own rails** = x402 on Kite testnet via Pieverse. Honest, but Passport is a smaller part of the build than in Capsule. |
| **What is real vs mocked** | **Real:** 2 Base-mainnet USDC payments (independently verified), 2 Passport refusals, a keccak hash-chained log, a signature I verified recovers to Kite's published key, a `/proof.json` that re-reads the chain per request. **Mocked/synthetic:** Scout's trend series is a seeded PRNG (`src/catalog.ts:134-183`). **Self-asserted:** the refusals are *not* chain-verified; the log is owner-rewritable and re-signable. | **Real:** 3 Kite-testnet pieUSD payments (independently verified), a signed `records.json` byte-identical to the live feed, 204 passing tests with the model and payment rail faked, a reproducible eval script. **Mocked/synthetic:** the two demo sellers are Tare's own fixtures. **Admitted:** no Passport payment exists, publisher `did: null`, testnet only, no real money. |
| **Proof & evidence shown** | Chain re-read at request time + hash chain + DID-linked signature + a `npm run verify` gate. **But** the headline README table is stale, the verifier exits 1 on a clean clone, and there is no committed eval. | Chain-verifiable hashes, a signed feed other agents can pin by address or Kite DID, a published eval with the prompt sha256s, a demo video with narration and subtitles. **Weakest point:** the eval *result* is not committed; the publisher's DID binding is `null`. |
| **Demo quality** | Live app is a well-designed, accessible, dark/light record page with real chain data. **No video.** Live URLs: app + `/proof.json`. | Static site (landing, console, receipt, sellers, `/check`, docs) **plus** a 1:50 voice-over video with subtitles built from a committed `video/` pipeline. Every hash in the video is the published run. |

## Patterns that make Tare read as strong

1. **A decision the model is not allowed to make — and a *named* one.** "SERV reads; code decides." The
   verdict function is pure and the model is structurally excluded from it.
2. **Honest limitations that cut against the author.** *"No Passport payment hash exists for this run,
   and none is shown."* *"Caps: enforced by Tare's own ledger… not by a Passport session."* That one
   sentence is the most credible line in the whole corpus.
3. **Measured results with the measurement committed.** Prompt sha256s published; eval cases in a
   committed script; "the default filter refused plain texts like 'Here is your data.', and accuracy
   was 7/9" — including the *worse* number, and including a sponsor feature they measured and
   deliberately kept off.
4. **A before/after demo story in three beats.** A disputed → A stopped (zero payment) → B verified.
   No narration needed to understand it.
5. **A protocol-level detail as the product.** The **402 advertisement** — the promise made *before
   any money moves* — is checked against the same rows, producing `advertised:fields` failures.
   Almost nobody in the field reads the pre-payment advertisement.
6. **A third-party-readable, signed, pinnable feed** other agents can opt into, with no global
   blacklist and fail-open feed handling.
7. **A number that makes the problem concrete.** "1,240 promised, 860 unique, 40 empty timestamps" —
   judges can hold that in their head.

## Tare's weaknesses (a good audit shouldn't only praise)

1. **No Passport in the money path.** Its caps are self-imposed (`src/x402direct.js:24-45`) — the exact
   pattern Capsule's BRIEF calls table stakes. A judge could reasonably ask "is this different from
   Tender?"
2. **Testnet only, pieUSD, no real value.** Real-money evidence is absent.
3. **The publisher's DID is `null`** (`records.json` → `signature.did`), so the `did:kite:` pin path is
   implemented but **not exercised** by the published feed. The README:214-216 admits the binding
   needs one-time Kite onboarding.
4. **The 9/9 · 6/6 eval result is not a committed artifact** — same failure mode as Capsule's README,
   just smaller.
5. **Its two demo sellers are its own fixtures**, so "the label is not the delivery" is demonstrated
   against a seller built to mislabel. `scripts/real_probe.mjs` exists to probe real sellers, but the
   published run uses the fixtures.
6. **`unverifiable` is treated as a hold.** Fail-closed is defensible, but it means a seller that says
   nothing gets held — a false-positive risk in a real feed.
7. **Its feed is opt-in and unadopted.** No third-party agent is shown trusting it; the "an agent that
   trusts the feed never pays a seller Tare caught" claim is demonstrated by Tare's own agent.
8. **`npm audit --omit=dev`: 5 high-severity advisories** (zod transitively via
   `@x402/core`/`@x402/evm`/`@x402/fetch` and `openai`) — Capsule's dependency tree is clean.
9. **Commercial thinness:** the feed lookup costs 0.001 testnet pieUSD. No revenue path.

## Ideas for Capsule, adapted from Tare's patterns (not Tare's idea)

1. **Give the model a decision it is not allowed to make — and say so in the README.** Right now the
   model both *chooses the endpoint* and *plans against the budget* (`src/agent.ts:318-334`). Move
   the budget-filtering into code: compute the affordable shortlist in `src/menu.ts` (the dead
   `affordable()` is already there), hand the model only that shortlist, and let it pick within it.
   Then the README can say *"the model picks from a list the code computed; it cannot spend more than
   X because it was never shown anything more than X."* That's the "code decides / model reads"
   separation, applied to Capsule's own problem. *Ties to creativity + technical execution.*
2. **Measure and publish one number instead of asserting the mechanism.** Capsule's proof is "the cap
   held". Tare's proof is "9/9, 6/6". Capsule's equivalent: run the same task at two caps and report
   **"facts covered: 2/5 at $0.0025, 5/5 at $0.06"** — the cap's effect on the answer, measured. One
   number, published, reproducible. *Ties to user readiness + revenue potential.*
3. **Check the seller's 402 advertisement too — for Capsule's own service.** Tare's `advertised:*` rule
   is Tare's idea, but the *mechanism* fits Capsule: your Scout's 402 challenge carries a `description`
   field (`src/app.ts:64` sets it from `entry.summary`). Have the agent read the merchant's
   **pre-payment advertisement** and record it in the log — so the record shows what the merchant
   promised *before* payment, next to what it delivered after. That's the natural extension of a
   "spend record" (it becomes a *promise-vs-delivery* record), and it's a differentiator Tare has on
   the seller side but Capsule can have on the **buyer-side receipt**. *Ties to creativity.*
4. **Publish a signed, pinnable record.** Capsule already signs its log head. Publish the log +
   receipts as a signed JSON feed (Tare's `canonical()` + EIP-191 over a sha256 is ~40 lines —
   `src/identity.js:21-47`) and let another agent pin the publisher by address or `did:kite:` against
   Kite's live key set. That turns "look at my proof page" into "other agents can trust my record".
   *Ties to the Kite gate + technical execution.*
5. **Make the demo a three-beat story like Tare's, from materials you already have.** Beat 1: the
   $0.05 endpoint that would have answered the question, **refused** (screenshot of the refusal). Beat
   2: the cheap substitute, **refused** (total budget). Beat 3: the agent answers with 2 of 5 facts
   and **names the other three**. You already have all three frames in `docs/decision-log.jsonl` and
   `docs/receipts.json`. Record them, don't rebuild them. *Ties to user readiness.*

---

## Bottom line

The engineering in Capsule is better than the presentation in Capsule, and the presentation is what a
judge sees first. Tare wins the same week on narrative, measured discipline and a finished artifact —
while having *weaker* sponsor-tech integration and *no* real-money settlement. Copy Tare's **evidence
discipline**, keep Capsule's **Passport-enforced cap**, and close the README gap before anything
else. The deadline is Nov 15 23:59 UTC; the six highest-leverage hours are items 1–3 of the fix list.
