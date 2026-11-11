# Submission pack

Everything the SERV Hackathon 02 form asks for, ready to paste. The form has 21 fields,
12 required. **You publish the X post and submit the form — I do not.**

## The form, field by field

| # | Field | Required | Value |
| --- | --- | --- | --- |
| 1 | Full name | yes | *Akolade Abraham Fatoki* |
| 2 | Email | yes | `akoladefatoki108@gmail.com` |
| 3 | Are you new to building with OpenServ? | yes | **Yes** |
| 4 | Which track are you submitting to? | yes | **Kite** |
| 5 | New project, or existing project with new work? | yes | **A new project** |
| 6 | What is your project called? | yes | *Capsule* — **confirm the name with the user first** |
| 7 | Tell us about your project | yes | the write-up below |
| 8 | URL for your project | yes | `https://capsule-phi-blond.vercel.app` |
| 9 | X post URL | yes | *paste after posting* |
| 10 | One additional project URL | no | `https://github.com/unifyWeb3/capsule` |
| 11 | Project logo or icon | no | optional |
| 12 | Is data collection enabled for your project? | yes | **Yes** — enabled at `console.openserv.ai/settings/organization` |
| 13 | Which best describes your team? | yes | *I'm participating solo* |
| 14 | How much experience do you have building AI agents? | no | *Some hands-on experience* or *Extensive experience* — **the user's call** |
| 15 | Country | no | `NG` |
| 16 | Company or school | no | *the user's call* |
| 17 | Current role | no | *the user's call* |
| 18 | LinkedIn / GitHub profile or personal site | no | `https://github.com/unifyWeb3` |
| 19 | What has your experience with SERV been like? | no | optional |
| 20 | May we share your feedback as a quote? | no | *the user's call* |
| 21 | Would you like to receive OpenServ updates? | no | *the user's call* |

## The write-up (field 7)

> Capsule is a spend-control and payment-attestation layer for AI agents.
>
> The problem: when you let an AI agent spend real money, the agent is usually also the
> thing holding the limit — a budget guard written into its own repository, which it can
> read. When a purchase goes wrong, the operator cannot show what was actually allowed.
>
> Capsule moves the limit out of the agent. SERV Reasoning decides what to buy and when
> to stop. A Kite Passport session, approved with the user's passkey and held in the
> Passport's backend, is the only thing that can release funds; the merchant settles the
> USDC on Base mainnet through the x402 protocol.
>
> In the recorded run the agent was given one question — a cautious assessment of ETH —
> and a budget of $0.0025, with a $0.002 ceiling on any single purchase. It made five
> attempts. Two payments settled on chain, at $0.001 each, each a USDC transfer of
> exactly 1000 base units. Three purchases were refused by the Passport: the one that
> would actually have answered the trend question ($0.05, over the per-call ceiling), one
> that would have taken the total over budget, and one after the session was exhausted.
> The agent covered two of the five facts the answer needed and named the other three as
> unchecked rather than guessing.
>
> Every payment carries a receipt, and `/proof.json` re-reads each transaction from the
> chain at request time and checks the USDC transfer against the receipt, so a judge can
> verify the run without an account.

## X post 1 — the announcement (publish first)

> We built **Capsule** for the **#SERVHackathon** Edition 02, Kite track.
>
> **An agent that spends your money under a limit you signed — and every payment carries
> proof it never went over.**
>
> The catch with giving an agent money is that the agent is usually also the one holding
> the limit. Most of the field solves that by writing a budget guard inside the agent's
> own repo — a number it can read.
>
> Ours can't. **SERV Reasoning** decides what to buy and when to stop. A **Kite Passport**
> session, signed with a passkey and held outside our program, is the only thing that can
> release funds. In the recorded run the agent tried to buy the endpoint that would
> actually answer the question; the Passport refused it because it was over the
> per-call ceiling. It bought the cheap evidence instead, ran out of budget, and named
> the three facts it could not check instead of guessing.
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
> Five attempts. Two settled on chain, $0.001 each. Three refused by the Passport — over
> the per-call cap, over the total budget, and after the session was used up.
>
> The refusal is the product.
>
> #BuildOnSERV #Kite #x402

## Before you post

- [ ] Tag **@openservai** in both posts.
- [ ] Replace the project name if it is not "Capsule".
- [ ] Attach a screenshot or a short clip of the refusals — the event asks for images.
- [ ] Post both, then paste each URL into the form.

## Still open

- The product name (working label: **Capsule**).
- The demo video. The form accepts a demo *link* and the live app is one; a 30-second
  capture of the refusals is the strongest thing in post 2.
- Fields 14, 16, 17, 20, 21 — the user's call.
- **Data collection must be enabled** at `console.openserv.ai/settings/organization`
  before submitting. This is an eligibility gate, not a detail.
- The submission itself.
