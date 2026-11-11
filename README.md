# Capsule

**An agent that spends your money under a limit you signed — and every payment carries proof it never went over.**

SERV Reasoning decides *what* to buy and *when to stop*. A **Kite Passport session**,
approved with your passkey and held outside this program, is the only thing that can
release funds. Nothing in this repository can raise that limit.

<!-- Judge-reachable surfaces -->
| | | | | |
| --- | --- | --- | --- | --- |
| **Live app** | **Proof page** | **Machine-readable proof** | **Repository** | **Settlement** |
| `capsule-phi-blond.vercel.app` | `/proof.json` | `/proof.json` | this file | Base mainnet, USDC |

Built for the **SERV Hackathon, Edition 02 — Kite track**.

---

## Judge it in 60 seconds

1. Open **`/proof.json`**. It lists every purchase the agent made and every purchase the
   session refused, then **re-reads each transaction from the chain** and checks the USDC
   transfer against the receipt. The page reports what the chain says, not what this
   repository claims about it.
2. Look at the refusals. One purchase was refused because it exceeded the
   **per-transaction cap**; another because it would have exceeded the **total budget**.
   Both refusals came from the Passport's backend. Our code has no branch that can allow
   them.
3. Open a paid endpoint without paying and read the challenge:

   ```bash
   curl -sD- -o/dev/null 'https://capsule-phi-blond.vercel.app/v1/briefing?topic=ETH'
   ```

   You get `402 Payment Required` and a `PAYMENT-REQUIRED` header holding the exact
   terms: scheme, network, asset, amount, and the address that receives the money.

## What the agent is actually doing

The task is *"give me a cautious assessment of ETH: has it trended up this month, how
volatile is it, and what are the main risks?"* — answered by buying data.

The model buys the cheapest evidence that can answer the question, and buys it only when
the answer still needs it. When the session refuses a purchase, the refusal is fed back
as state and the model chooses what to do next: buy something cheaper, or answer with
what it already holds and say plainly what it could not check.

```
question
  │
  ▼
SERV Reasoning ──proposes──► one endpoint, one price
  │                              │
  │                              ▼
  │                        kpass session execute
  │                              │
  │              ┌───────────────┴───────────────┐
  │              ▼                               ▼
  │        allowed: paid                 refused: session_rule_exceeded
  │              │                       session_total_exceeded
  │              ▼                               │
  │         evidence held                         └──► back to the model as state
  ▼
answer, naming what it could not check
```

## How the limit is enforced

This is the part that matters, so it is worth being precise about.

| Layer | What it does | Where |
| --- | --- | --- |
| The model | proposes one purchase at a time. It is never told the price of a cap and it cannot set one | `src/agent.ts` |
| The Passport backend | holds the delegation, checks the amount against `max_amount_per_tx` and the running total against `max_total_amount`, and refuses in its own code | Kite Passport, `session_rule_exceeded` / `session_total_exceeded` |
| The merchant | publishes the price in the x402 challenge; the amount that gets signed is the amount the merchant asked for, not what the model believed it was paying | `src/seller.ts`, `src/kite.ts` |
| The facilitator | verifies the payment signature and settles the USDC transfer on chain | `https://facilitator.pieverse.io/v2` |
| This repository | routes, records and proves. It cannot move money by itself | `src/app.ts`, `src/proof.ts` |

The limit is enforced **outside** the process that wants to spend. That is the whole
difference between this and the common pattern, where the agent caps itself in a config
file it can read.

## Capability → mechanism → code

| Capability | Mechanism | Code |
| --- | --- | --- |
| The agent decides what to buy | SERV Reasoning, OpenAI-shaped chat completions with a JSON decision schema | `src/serv.ts` |
| The agent buys exactly one thing at a time | a bounded loop: propose → pay → fold the outcome back as state | `src/agent.ts` |
| The spending limit is the user's | a Kite Passport spending session approved with a passkey | `kpass session create --separate` |
| The refusal is the product | `session_rule_exceeded` and `session_total_exceeded` are read as state, not as errors | `src/kpass.ts`, `src/agent.ts` |
| The price comes from the merchant | the x402 challenge, parsed from the `PAYMENT-REQUIRED` header | `src/app.ts` |
| Settlement on a real chain | x402 v2 `exact` scheme, EIP-3009 `transferWithAuthorization`, settled by the facilitator | `src/kite.ts` |
| The proof is re-checked, not remembered | `/proof.json` reads each transaction and its `Transfer` log from the chain at request time | `src/proof.ts` |
| The numbers are not typed by hand | every figure comes from the claims registry, generated from the run | `scripts/generate-claims.ts`, `docs/CLAIMS.md` |
| The receipts are the record | one line per attempt: price, outcome, error code, transaction hash, running total | `src/agent.ts` → `docs/receipts.json` |

## The service it buys from

**Scout** is the merchant, included here because a judged round needs something real to
buy. It sells market statistics in three depths, and every payload says which parts were
read live and which were derived:

| Endpoint | Price | What you get |
| --- | --- | --- |
| `GET /catalog` | free | the price list, so an agent can price its options before spending anything |
| `GET /v1/snapshot?topic=ETH` | $0.02 | spot price, 24h change, 24h volume |
| `GET /v1/history?topic=ETH` | $0.05 | 7d and 30d return, realized volatility, max drawdown, distance from the 30d mean |
| `GET /v1/deep?topic=ETH` | $0.10 | the same statistics rebuilt from a 90-day window |
| `GET /v1/briefing?topic=ETH` | $0.25 | flows, sentiment, risk factors, catalysts, a stance |

Spot prices are read live from CoinGecko. The trend statistics are derived from that live
price by a deterministic, seeded series, and every derived field is labelled `derived`.

## Run it yourself

```bash
git clone <this repository> && cd capsule
npm install
cp .env.example .env          # add SERV_API_KEY from console.openserv.ai
npm test                      # 11 tests
npm start                     # the merchant on :8080
```

To run the agent you need three things this repository cannot provide: a SERV API key,
a Kite Passport agent with a runtime key, and a spending session approved with a passkey.

```bash
kpass agent init
kpass agent create --uid capsule-agent --kind buyer --name Capsule --url https://<your-host>
kpass agent token create --agent <agent-id>
kpass agent bind --agent <agent-id> --token <token>

kpass session create --separate \
  --task-summary "Capsule demo: buy market data under a user-signed spending cap" \
  --max-amount-per-tx 0.10 --max-total-amount 0.20 --ttl 168h --assets USDC

npm run demo                   # one task, end to end, writes docs/receipts.json
npm run claims                 # regenerates docs/CLAIMS.md from the run
```

## The business model

**Stated as a hypothesis, and it is one.** Spend-control software is a real, budgeted
market — corporate card controls and API spend caps are things companies already pay for.
The model here is a per-agent, per-user cap sold to the operator of a spending agent,
which is the buyer who carries the chargeback risk. The unit economics are per-agent
monthly, with the platform fee a share of the spend it caps.

No customer has been found, no commitment obtained, and no revenue exists. We are
claiming a plausible position in a market that exists, not traction.

## Honest limitations

- **The pilot's caps are tiny.** $0.10 per call and $0.20 in total. The scale is set by
  a small test wallet, not by the design. The mechanism does not care about the magnitude.
- **The settlement chain is Base, not Kite chain.** Kite Passport is multichain and the
  wallet that funded the run holds USDC on Base, so settlement is direct and costs no
  bridge. Settling on Kite chain instead is a configuration change, not a redesign, but
  it is untested here.
- **The seller's data is partly derived.** Spot prices are live; the trend statistics are
  generated from them by a seeded rule. A production service would carry real history.
- **One task, one agent, one session.** There is no multi-agent orchestration, no retry
  policy, no database, and no queue.
- **The KYC record for the account is still pending review.**

## Disclosures

- Built with [SERV Reasoning](https://docs.openserv.ai/serv-reasoning/introduction) and
  [Kite Agent Passport](https://docs.gokite.ai/passport).
- The merchant, the agent, the proof endpoint and the registry are ours. The x402
  protocol, the Pieverse facilitator, CoinGecko and Kite are not.
- The private keys for the merchant and the agent live outside this repository, and the
  agent's runtime key is what makes its spending attributable to its DID.
- Prices are quoted in USDC and settle on the chain named in the x402 challenge.

## Licence

MIT.
