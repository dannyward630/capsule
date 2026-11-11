# X post draft

The submission form asks for the URL of an X post about the project, and the form's own
description says: *"Post about your project on X, tag @openservai, and paste the URL
here."* The event page repeats it: a public post including the name, the concept, images,
any further links, and a tag of @openservai.

**You publish this. I cannot.** Here is the text, ready to paste.

---

## Post 1 — the announcement (publish first)

> We built **Capsule** for the **#SERVHackathon** Edition 02, Kite track.
>
> **An agent that spends your money under a limit you signed — and every payment carries
> proof it never went over.**
>
> The catch with giving an agent money is that the agent is also the one holding the
> limit. Most of the field solves that by writing a budget guard inside the agent's own
> repo — a number it can read.
>
> Ours can't. **SERV Reasoning** decides what to buy and when to stop. A **Kite Passport**
> session, signed with a passkey and held outside our program, is the only thing that can
> release funds. When the agent tried to buy more than you allowed, the Passport refused
> it — twice, for two different reasons — and the agent finished with what it could
> afford and said plainly what it could not check.
>
> Live app and the receipts, re-checked against the chain:
> https://capsule-phi-blond.vercel.app
>
> Repo: https://github.com/<owner>/<repo>
>
> #BuildOnSERV #Kite #x402 #AgenticPayments

---

## Post 2 — the evidence (publish after the run, before submitting)

> The run, with every number checked against Base:
> https://capsule-phi-blond.vercel.app/proof.json
>
> Four attempts. Two settled on chain. Two refused by the Passport — one over the
> per-transaction cap, one over the total budget. The agent's answer names what it could
> not check instead of guessing.
>
> The refusal is the product.
>
> #BuildOnSERV #Kite #x402

---

## Checklist before you post

- [ ] Tag **@openservai** in the post.
- [ ] Replace `https://github.com/<owner>/<repo>` with the real repository URL.
- [ ] Paste the receipts URL from the real run into Post 2.
- [ ] Attach a screenshot or a short clip of the run (the event asks for images; a 10-second
      capture of the refusals is enough).
- [ ] Post both, then paste each URL into the form field.

## The write-up field (form field 7)

> **Tell us about your project. What does it do, who is it for, what problem does it solve,
> and how does it work?**

> Capsule is a spend-control and payment-attestation layer for AI agents.
>
> The problem: when you let an AI agent spend real money, the agent is usually also the
> thing holding the limit — a budget guard written into its own repository, which it can
> read. When a purchase goes wrong, the operator cannot show what was actually allowed.
>
> Capsule moves the limit out of the agent. SERV Reasoning decides what to buy and when to
> stop. A Kite Passport session, approved with the user's passkey and held in the
> Passport's backend, is the only thing that can release funds; the merchant settles the
> USDC on Base mainnet through the x402 protocol.
>
> The demo agent is given one question — a cautious assessment of ETH — and a budget. It
> buys the cheapest evidence that can answer the question, and when the session refuses a
> purchase the refusal is fed back to the model as state. It then buys something cheaper
> or answers with what it holds, naming what it could not check. Two purchases were
> refused in the recorded run: one over the per-transaction cap, one over the total
> budget.
>
> Every payment carries a receipt, and `/proof.json` re-reads each transaction from the
> chain at request time and checks the USDC transfer against the receipt, so a judge can
> verify the run without an account.
