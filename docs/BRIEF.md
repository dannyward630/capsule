# Product brief — SERV Hackathon 02, Kite track

Working name: **Capsule** (placeholder — confirm before it appears in the README, the
write-up, or the form). Repo: `/home/unify/serv`. Deadline: **2026-11-15 23:59 UTC**.

Written 2026-11-11. Claims marked *verified* were checked against a command or a fetch
in this session; everything else is marked as a hypothesis or an assumption.

---

## The weakest part, stated first

**There is no customer.** Payment evidence for this product sits at **level 5** — our own
belief. We can state a business model that names a comparable and a price, and that is
what the field does (EXHIBIT A, an Edition 01 winner, claims 15% of recovered funds
against a stated 20–30% market rate; Tender, the other winner, had no model at all). But
a stated model is not revenue, and in four days with no budget for customer contact we
cannot move it above level 5.

**What this changes.** It does not change whether we build — the judge criteria are
creativity, user readiness and revenue potential, and a credible *stated* model is what
the winning entries have. It changes the claim we are allowed to make. We may not say
"people want this" or "companies pay for this." We may only say what the artifact does,
and label the business model as a hypothesis in both the README and the write-up.

Second weakness, **the consumer moment is thinner than the operator moment**. Nobody
wakes up wanting "spend proof." They wake up wanting "book my trip" or "don't let it
spend more than fifty dollars." The buildable product serves the *operator*; the
user-facing story must therefore be a concrete moment (a user disputing a charge their
agent made), not a category.

Third weakness, **the Passport integration is unproven until Phase 0 finishes**. If an
approved session cannot execute a payment from a hosted environment, the demo has to run
locally, and "the deployed artifact is the tested artifact" weakens. This is the first
thing we test, before writing product code.

---

## The product

**Capsule** is a spend-control and payment-attestation layer for AI agents.

SERV Reasoning decides *what* to buy and *when to stop*. A Kite Passport session — signed
by the user's passkey, held outside our process, on a separate chain — is the only thing
that can release funds. Every payment comes back as a receipt carrying the session it was
made under.

The point is not that the agent is well-behaved. The point is that the limit is **not the
agent's to keep**.

### The claim, written once

> **An agent that spends your money under a limit you signed — and every payment carries
> proof it never went over.**

This is the README's first line, the write-up's opening sentence, the demo's first
slide, and the constraint the implementation must satisfy. It is not a mechanism
sentence, and it is not "AI-powered" anything.

### Why this position is open

The whole Edition 01 field — 70+ submissions, four track winners, every featured entry —
builds an agent that **caps itself in its own code**. Tender, the closest analog to the
Kite track (Edition 01, AgentKit track, "an agent that pays for exactly the data it
needs, and no more") implements its entire limit story as a `BudgetGuard` inside its own
repository: a hardcoded total budget, a per-call cap, a maximum purchase count, and
origin/network/token/recipient allowlists. It is good work, and it is still the agent
grading its own homework. The Kite track is the one track where the cap can be somebody
else's — a passkey-approved session on a separate chain that our code physically cannot
exceed. Nobody in the field took that axis.

The Kite AI Global Hackathon 2026 winners took the same gap from the other side:
Flattora lets you "enter your budget and preferences," but a budget typed into an app is
a promise; a budget signed with a passkey is a constraint.

---

## Six gates

| Gate | Answer | Specificity check | Status |
| --- | --- | --- | --- |
| **Moment** | An operator of an agent that spends money for other people — a booking agent, a billing agent, a purchasing agent — faces a user saying "I never approved that." Today they cap the agent with a number in their own code and cannot reconstruct what was allowed when it is disputed. The cost of getting it wrong is a chargeback and an unanswered support ticket; the cost of not delegating is the operator doing the work themselves | Who: the engineer who owns a spending agent. When: the first dispute or the first bill that surprises them. Cost of status quo: chargeback liability plus the hours spent reconciling | **pass** |
| **Reframe** | Category by problem: **spend control and payment attestation** — the same job corporate card controls do, applied to software that spends money without a human in the loop. Not an "AI agent" product. If this technology vanished, the job that remains is "know exactly what your agent spent and be certain it could not spend more than you allowed" — a budget-and-audit job that already has a market | Names the buyer, the incumbents (corporate card and spend-management software), the price reference, and the credible proof points (itemized receipts, per-task limits, expiry) | **pass** |
| **Substitute** | Three, and they are all weaker than the claim: (1) a virtual/corporate card with a hard limit — caps in dollars, with no per-task identity, no expiry, no passkey-scoped delegation and no itemized proof of what was bought and why; (2) a spending cap written in the agent's own code, which is what every Edition 01 entry does, including Tender's `BudgetGuard` — the agent can read that number; (3) **nothing** — don't delegate. Only (3) is a real absence of spend; (1) and (2) are existing spend we are competing for | Names the incumbent to beat. The substitute's limits become the feature list: per-task, expiring, itemized | **pass** |
| **Payer** | The **operator**, not the end user. The end user gets the cap they signed; the operator carries the chargeback liability and the infra bill, so the operator has both the budget and the trigger. A consumer would not buy a control layer for their own delegation — that buyer fails the "narrowest buyer who can actually pay" test. This matches where Kite itself is heading: Kite's CTO previewed "Kite Gateway, a developer product for per-user cost control in agentic applications" at the July Kite Global finale | Names one buyer with a budget line: the operator's per-agent spend and liability. Channel: operators already at agent-payments events and already shipping agents | **pass** (weakest payer claim — reachability unverified) |
| **Repeat** | Spend is a flow, not a purchase. Every agent run consumes budget; every new task needs a new session; every month the spend policy is reviewed and the caps move. The trigger for a second purchase is the next task, and the next task is daily for any agent in production | Names the event | **pass** |
| **Payment evidence** | **Level 5** — our own belief. No customer, no signed commitment, no confirmed budget line. Adjacent level-3 context: spend-control software and LLM API spend caps are existing, budgeted spends that operators already pay for. Level 1 and 2 are unreachable in four days with no customer-contact budget | Honest: stated as a hypothesis in the README and the write-up, never as a fact | **unresolved — level 5, stated as a hypothesis** |

**Weakest gate: payment evidence (level 5).** Second weakest: the payer reachability.

---

## Explicit non-goals

- Not a wallet, a card issuer, or a spend-management dashboard.
- Not a Kite Gateway competitor. We use Passport's primitives; we do not build a control plane.
- Not "an agent that books travel." Flattora did that in the Kite Global Hackathon. No vertical booking here.
- Not multi-agent orchestration, a token launch, or an agent marketplace.
- Not a claim that the consumer pays for this.
- Not a simulator. If the session cannot pay, the run is marked unverified, not faked.

---

## Essential scope

1. An agent with its own secp256k1 runtime key and DID, registered as a buyer.
2. A tiny priced seller (x402) with a free catalog and three paid tiers, as in Tender's
   `src/seller` — something real to buy.
3. SERV Reasoning plans the purchase sequence and decides when to stop.
4. A Kite Passport session with `max-amount-per-tx` and `max-total-amount`, approved by
   the user's passkey.
5. One run: buy tier 1 → buy tier 2 → attempt tier 3 → **refused by the session cap** →
   the agent degrades and states what it could not check.
6. A receipt per payment: service, amount, session id, transaction hash.
7. A read-only proof page plus a machine-readable proof endpoint a judge can fetch
   unauthenticated.
8. A CLI that runs one task end to end from a clean checkout.

## Acceptance evidence

| Requirement | How it is shown |
| --- | --- |
| The limit is not ours | The session id and its limits appear in the receipt; the refusal comes from the session, not from a `if` in our code |
| The refusal happens | The run log shows the attempted purchase and the refusal |
| The agent degrades | The final answer states what it could not check and why |
| Every payment is real | A transaction hash per payment, checkable on the Kite chain explorer |
| A judge can check it in 60 seconds | Proof page + a 60-second judge script in the README |

## Stack

Node 20+, plain JavaScript (ESM), **no runtime dependencies**, `node:test` for tests,
Vercel serverless (`api/` + `public/`) so the deploy is zero-config. The Kite Passport
calls shell out to the `kpass` binary with `KPASS_RUNTIME_KEY_FILE` and the
`.kite-passport/` project state. This mirrors the winning Edition 01 stacks (Tender and
EXHIBIT A both ship "no dependencies, Node 20+, deploys to Vercel as-is").

## Constraints

| Constraint | Value | Verified |
| --- | --- | --- |
| Time | 4d 10h as of 2026-11-11 13:48 UTC | yes |
| Cash | $0 — the user already holds USDC and bridges it themselves | user-confirmed |
| Team | Solo; the user holds the OpenServ and Kite accounts | user-confirmed |
| SERV credits | $5 for pre-registered participants | event FAQ — unverified in the console |
| Data collection | must be enabled at console.openserv.ai/settings/organization | Edition 01 FAQ; Edition 02 form asks it — treat as a gate |

## Risks, worst first

1. **The approved session cannot execute from the deployed environment.** Test in the
   first two hours. If it cannot, the demo is a recorded local run plus a live
   read-only proof page, and the write-up says so plainly.
2. **Four days is not enough** for agent + seller + payments + demo + video + write-up.
   Cut order: video → extra tiers → extra UI. Never cut the refusal path, the receipts,
   or the proof endpoint.
3. **No user contact**, so "user readiness" rests on the 60-second judge script alone.
4. **SERV credit exhaustion.** $5 is a few dozen calls. The agent must cache catalog
   reads and reuse one reasoning call per purchase decision, not per candidate.

## What is deliberately not decided yet

The final product name, the exact vertical (booking vs billing vs purchasing), and
whether the deployed app or the local CLI is the primary demo surface. The first is a
naming decision for the user; the third depends on risk 1.
