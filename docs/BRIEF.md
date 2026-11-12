# Product brief — Capsule

SERV Hackathon, Edition 02, Kite track. Rewritten 2026-11-12 against the **actual**
field (23 public Edition 02 entries), not against Edition 01 prior art.

## The weakest part, stated first

**There is no customer, and no evidence of demand.** Payment evidence for this product
sits at **level 5** on the scale in the value-articulation guide — our own belief. No
buyer has been found, no budget line confirmed, no commitment obtained. We may state a
hypothesis about who would pay, but we may not say people want this, and no number in
the README or the write-up may imply otherwise. A second, milder weakness: the
per-call and total caps in the recorded run are tiny, because the wallet that funded
it is small. The mechanism does not care about the magnitude; a judge should not be
led to think it does.

## The claim, written once

> **Every purchase your agent made, every one it was refused, and the price of each.**

It is the README's first line, the write-up's opening, the demo's first line, and the
constraint the implementation must satisfy.

## The operator brief — one paragraph

**The buyer is the operator of an agent that spends money on other people's behalf — a
booking agent, a research agent, a purchasing agent — and not the end user, because an
individual does not buy a control layer for their own agent and has no budget line for
it, while the operator carries the liability when the agent's purchase is disputed and
has to answer for it; the line item is "agent spend control", a per-agent and per-user
cap that sits beside the inference bill it bounds and is signed by the same person who
signs that bill; and it replaces the two things that exist today, which are a number in
the agent's own repository and a corporate card with a dollar limit and no per-task
identity, no expiry and no itemised record, neither of which can produce anything an
operator can hand to a customer, an auditor or a court when the agent's purchase is
challenged — Capsule produces exactly that record, every purchase, every refusal and
the price of each, decided by the Passport rather than by the agent. We have no
evidence that anyone wants this: no customer, no commitment, and no signal beyond the
observation that all 23 public entries in this event are mechanism demos with no named
buyer, which means the field is weakest on exactly this criterion and so, for now, are
we.**

## Why this position and not another

The field scan (23 public entries, 12 in the Kite lane) shows four lanes taken:

1. **"A cap or policy sits in front of the payment."** centiv, KiteSpendGuard,
   spendsafe, aijajan, agent-firewall, QuoteSeal, signoff, uptimebuyer, layover,
   plot-twist. Ten entries. **Saturated.** "The limit is somebody else's" is table
   stakes in this lane, not an edge.
2. **"A score or verdict drives the limit."** spendgrade, agentfico.
3. **"Verifiable / receipts / audit trail."** blackbox, vault-pilot, launcheck,
   hack-openserv-serv, tranche. The word "verifiable" is everywhere.
4. **"A niche vertical."** bounty scout, trip guardian, gift designer, refrigeration
   recovery, Sui handover recovery, RWA treasury. Every entry has one.

**What is not taken: the owner.** Every entry makes the *agent* the subject — the agent
that spends, misbehaves, earns, negotiates, buys travel. Nobody builds the record that
answers *"what did my agent buy, what did it want to buy and did not, and what did it do
instead?"* That question belongs to the person who owns the money, and it is the
question a chargeback, an audit or a worried customer actually asks.

The same holds against the Kite Global Hackathon's eight winners. Each took the
Passport's identity-plus-limits primitive and attached something the limits alone
cannot do — a physical object, a delivery bond, a cross-border remittance, a swarm with
attribution, a fair revenue split, a mandate economy, a negotiation protocol, a
behavioural fingerprint. **Not one of them is another cap**, and not one of them is
built around the owner either.

## The six gates

| Gate | Answer | Status |
| --- | --- | --- |
| Moment | An operator's agent is about to spend money and the operator cannot see it happening or reconstruct it afterwards. Today the budget is a number in the agent's own code | pass |
| Reframe | Spend control and payment attestation — the job corporate card controls do, applied to software that spends money without a human in the loop | pass |
| Substitute | A virtual card with a dollar limit and no per-task identity or expiry; a cap in the agent's own code; or nothing — don't delegate | pass |
| Payer | The operator, who carries the liability and the inference bill. Not the end user | pass, weakest payer claim |
| Repeat | Spend is a flow: every run consumes budget, every task needs a session, every month the policy is reviewed | pass |
| Payment evidence | **Level 5.** A hypothesis, stated as one | **unresolved — level 5** |

## Non-goals

- Not a wallet, a card issuer, or a spend-management dashboard.
- Not a Kite Gateway competitor: we use Passport's primitives, we do not build a control plane.
- Not "an agent that books travel" — Flattora did that in the Kite Global Hackathon.
- Not a token launch, an agent marketplace, or multi-agent orchestration.
- Not a claim that the end user pays for this.

## What the recorded artifact actually proves

| Claim | Evidence |
| --- | --- |
| The refusals came from the Passport, not from us | `session_rule_exceeded` and `session_total_exceeded` are the Passport's own error codes, returned by the backend |
| The payments are real | Two USDC transfers on Base, each exactly 1000 base units, re-read from the chain at request time by `/proof.json` |
| The record is tamper-evident | `docs/decision-log.jsonl`, keccak-256 hash chain, head `0x6ab76d14…`; editing any earlier record breaks every link after it |
| The agent degrades honestly | The recorded answer quotes real figures and names the three facts it could not check, and why |
| The merchant is not a one-seller trick | Three distinct hosts across the run: `agent402.tools`, `x402.ottoai.services`, `google-trends.use.x402atlas.com` |
| The deployment is the tested artifact | `npm run verify` — 13 checks against the live deployment, exit 0 |
