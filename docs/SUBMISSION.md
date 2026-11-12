# Submission pack — SERV Hackathon 02, Kite track

Everything the form asks for, ready to paste. 21 fields, 12 required. **You publish
the X posts and submit the form — I do not.**

## The claim

> **Every purchase your agent made, every one it was refused, and the price of each.**

Refusals decided by your Kite Passport session, not by the agent.

## The form, field by field

| # | Field | Required | Value |
| --- | --- | --- | --- |
| 1 | Full name | yes | *Akolade Abraham Fatoki* |
| 2 | Email | yes | `akoladefatoki108@gmail.com` |
| 3 | Are you new to building with OpenServ? | yes | **Yes** |
| 4 | Which track are you submitting to? | yes | **Kite** |
| 5 | New project, or existing project with new work? | yes | **A new project** |
| 6 | What is your project called? | yes | **Capsule** |
| 7 | Tell us about your project | yes | the write-up below |
| 8 | URL for your project | yes | `https://capsule-phi-blond.vercel.app` |
| 9 | X post URL | yes | *paste after posting* |
| 10 | One additional project URL | no | `https://github.com/unifyWeb3/capsule` |
| 11 | Project logo or icon | no | optional |
| 12 | Is data collection enabled for your project? | yes | **Yes** — enabled at `console.openserv.ai/settings/organization` |
| 13 | Which best describes your team? | yes | *I'm participating solo* |
| 14 | How much experience do you have building AI agents? | no | *the user's call* |
| 15 | Country | no | `NG` |
| 16 | Company or school | no | *the user's call* |
| 17 | Current role | no | *the user's call* |
| 18 | LinkedIn / GitHub profile or personal site | no | `https://github.com/unifyWeb3` |
| 19 | What has your experience with SERV been like? | no | optional |
| 20 | May we share your feedback as a quote? | no | *the user's call* |
| 21 | Would you like to receive OpenServ updates? | no | *the user's call* |

## The write-up (field 7)

> Capsule is the record of what your AI agent did with your money — including the
> purchases it was refused.
>
> The problem: when you let an agent spend real money, the agent is usually also the
> thing holding the limit. A budget guard written into its own repository is a number
> the agent can read, and the refusals that guard produces are the agent's own account of
> itself. When a purchase is later disputed, the operator has nothing.
>
> Capsule moves the limit out of the agent and keeps the record. SERV Reasoning decides
> what to buy and when to stop. A Kite Passport session, approved with the user's passkey
> and held in the Passport's backend, is the only thing that can release funds; the
> merchant settles the USDC on Base mainnet through x402.
>
> In the recorded run the agent was given one question — a cautious assessment of ETH —
> and a budget of $0.0025 with a $0.002 ceiling on any single purchase. It made four
> attempts. Two payments settled on chain, $0.001 each, each a USDC transfer of exactly
> 1000 base units. Two were refused by the Passport: the $0.05 endpoint that would
> actually have answered the trend question, over the per-call ceiling, and then a
> cheaper substitute, over the total budget. The agent covered two of the five facts the
> answer needed and named the other three as unchecked rather than guessing.
>
> The record has three independent anchors. The refusals were decided by the Passport,
> not by us. The payments are transactions on Base, re-read from the chain at request
> time by `/proof.json`. And the record itself is hash-chained and signed by the agent's
> runtime key, which Kite publishes against the agent's DID in its public directory — so
> a third party can check the record without trusting this program.
>
> `npm run verify` runs fifteen checks against the live deployment, including that the
> signature recovers to the address Kite publishes and that a tampered record does not
> verify.

## X post 1 — the announcement (publish first)

> We built **Capsule** for the **#SERVHackathon** Edition 02, Kite track.
>
> **Every purchase your agent made, every one it was refused, and the price of each.**
>
> When you let an AI agent spend real money, the agent is usually also the one holding
> the limit — a budget number inside its own repository, which it can read. And the
> refusals it produces are its own account of itself.
>
> Capsule moves the limit out of the agent, and keeps the record. **SERV Reasoning**
> decides what to buy. A **Kite Passport** session, signed with a passkey and held
> outside our program, is the only thing that can release the money.
>
> In our recorded run the agent tried to buy the endpoint that would actually have
> answered the question. The Passport refused it, over the per-call ceiling. It tried a
> cheaper substitute. The Passport refused that too, over the total budget. The agent
> answered with what it had, and named the three facts it could not check.
>
> Live app and the receipts, re-checked against the chain:
> https://capsule-phi-blond.vercel.app
>
> Repo: https://github.com/unifyWeb3/capsule
>
> #BuildOnSERV #Kite #x402 #AgenticPayments

## X post 2 — the evidence (publish after, before submitting)

> The run, every number checked against Base:
> https://capsule-phi-blond.vercel.app/proof.json
>
> Four attempts. Two settled on chain, $0.001 each. Two refused by the Passport — over
> the per-call cap, and over the total budget.
>
> The record is hash-chained, and signed by the agent's key — the one Kite publishes for
> its DID. `npm run verify` checks fifteen things against the live deployment.
>
> The refusal is the product.
>
> #BuildOnSERV #Kite #x402

## Before you post

- [ ] Tag **@openservai** in both posts.
- [ ] Attach a screenshot or a short clip of the two refusals — the event asks for images.
- [ ] Post both, then paste each URL into the form.

## Still open

- The contrast run: the same task under a larger limit, showing the agent completing
  the purchase it was refused before. Needs one approval.
- The demo video. Optional — the form accepts a demo link and the live app is one.
- Fields 14, 16, 17, 20, 21 — the user's call.
- **Data collection must be enabled** at `console.openserv.ai/settings/organization`.
  This is an eligibility gate, not a detail.
- The submission itself.
