# Capsule

**An agent that spends your money under a limit you signed — and every payment carries proof it never went over.**

SERV Reasoning decides *what* to buy and *when to stop*. A **Kite Passport session**,
approved with your passkey and held outside this program, is the only thing that can
release funds. Nothing in this repository can raise that limit.

<!-- Judge-reachable surfaces -->
| | | | | |
| --- | --- | --- | --- | --- |
| **Live app** | **Proof endpoint** | **Repository** | **Agent identity** | **Settlement** |
| `capsule-phi-blond.vercel.app` | `/proof.json` | `github.com/unifyWeb3/capsule` | `did:kite:ind-akoladefatoki108:capsule-agent` | Base mainnet, USDC |

Built for the **SERV Hackathon, Edition 02 — Kite track**.

---

## The recorded run

The agent was given one question — *a cautious assessment of ETH: price, trend over the
last month, volatility, main risks* — and a budget of **$0.0025** to answer it, with a
**$0.002** ceiling on any single purchase. It made five attempts.

| # | What it tried | Price | Outcome |
| --- | --- | --- | --- |
| 1 | `Agent402 Tools /api/crypto-price` | $0.001 | **paid** — `0x591ba92f…` |
| 2 | `Otto AI /filtered-news` | $0.001 | **paid** — `0xaeb58efc…` |
| 3 | `Google Trends /trend-over-time` | $0.05 | **refused** — `session_rule_exceeded` |
| 6 | `Otto AI /defi-analytics` | $0.001 | **refused** — `session_total_exceeded` |
| 8 | `Otto AI /funding-rates` | $0.001 | **refused** — `separate_session_used_up` |

**$0.002 spent of $0.0025.** Two payments settled on Base mainnet, each a USDC transfer
of exactly 1000 base units. Three purchases were refused by the Passport, for three
different reasons.

The interesting one is step 3. The model reached for `trend-over-time` because that is
the endpoint that actually answers "how has it trended this month", and it cost $0.05
against a $0.002 per-call ceiling. The Passport said no. The agent then bought the cheap
evidence instead, and when the total ran out it stopped and said what it could not check.

The agent covered **2 of the 5 facts** and named the other three as unchecked. It did not
guess.

## Judge it in 60 seconds

1. Open **`/proof.json`**. It lists every attempt, then **re-reads each transaction from
   the chain** and checks that a USDC transfer of exactly the expected amount moved in
   it. The page reports what the chain says, not what this repository claims about it.
   The response carries `all_payments_verified_on_chain`.
2. Look at the `chain_checks`: the block number, the confirmation count, the sender (your
   Passport wallet), the merchant's address, and the amount.
3. Open a paid endpoint without paying and read the challenge:

   ```bash
   curl -sD- -o/dev/null 'https://agent402.tools/api/crypto-price?coins=ETH&currency=usd'
   ```

   You get `402 Payment Required` and a `PAYMENT-REQUIRED` header holding the exact terms:
   scheme, network, asset, amount, and the address that receives the money.

## How the limit is enforced

This is the part that matters, so it is worth being precise about.

| Layer | What it does | Where |
| --- | --- | --- |
| The model | proposes one purchase for one missing fact. It is told the total budget. It is not told the per-transaction ceiling — that limit belongs to the Passport, and the agent discovers it by trying | `src/agent.ts` |
| The Passport backend | holds the delegation, checks the amount against `max_amount_per_tx` and the running total against `max_total_amount`, and refuses in its own code | Kite Passport: `session_rule_exceeded`, `session_total_exceeded` |
| The merchant | publishes the price in the x402 challenge; the amount that gets signed is the amount the merchant asked for, not what the model believed it was paying | `src/kite.ts` |
| The facilitator | verifies the payment signature and settles the USDC transfer on chain | `https://facilitator.pieverse.io/v2` |
| This repository | routes, records and proves. It cannot move money by itself | `src/app.ts`, `src/proof.ts` |

The limit is enforced **outside** the process that wants to spend. That is the whole
difference between this and the common pattern, where the agent caps itself in a config
file it can read.

## Capability → mechanism → code

| Capability | Mechanism | Code |
| --- | --- | --- |
| The agent decides what to buy | SERV Reasoning, chat completions with a strict JSON schema the model cannot step outside | `src/serv.ts` |
| The agent buys one fact at a time | a bounded loop: one fact → one proposal → one purchase → the outcome folded back as state | `src/agent.ts` |
| The spending limit is the user's | a Kite Passport session approved with a passkey | `kpass session create --separate` |
| The refusal is the product | `session_rule_exceeded` and `session_total_exceeded` are read as state, not as errors | `src/kpass.ts`, `src/agent.ts` |
| The price comes from the merchant | the x402 challenge, parsed from the `PAYMENT-REQUIRED` header | `src/app.ts` |
| Settlement on a real chain | x402 v2 `exact` scheme, EIP-3009 `transferWithAuthorization`, settled by the facilitator | `src/kite.ts` |
| The proof is re-checked, not remembered | `/proof.json` reads each transaction and its `Transfer` log from the chain at request time | `src/proof.ts` |
| The numbers are not typed by hand | every figure comes from the claims registry, generated from the run | `scripts/generate-claims.ts`, `docs/CLAIMS.md` |
| The receipts are the record | one line per attempt: price, outcome, error code, transaction hash, running total | `src/agent.ts` → `docs/receipts.json` |

## What the agent buys from

The menu is the **live Kite service catalog**, read with `ksearch`, filtered to the chain
and asset the session is funded for. Prices come from the catalog, not from us, so the
model is reasoning over real costs.

```bash
npm run menu     # rebuilds docs/menu.json from the catalog
```

29 endpoints priced in Base USDC were on the menu. The run used two of them — one from
`agent402.tools`, one from `x402.ottoai.services` — and tried a third from
`google-trends.use.x402atlas.com` that the per-call cap rejected. A judge can pay any of
them directly with their own Passport.

## The service we built

**Scout** is in this repository: a tiered x402 service on Base mainnet, with a free
catalog and four priced depths, and a proof page of its own.

It is **not** the service the recorded run bought from, and it received no money. The
Passport only pays hosts admitted to its catalog — the catalog's own service records say
so, *"Added via GOK-557 (host_not_allowlisted review)"* — and our host is not admitted.
We could not get it admitted inside the time we had, so the agent buys from third-party
merchants instead.

That is a real limitation and we are not hiding it: the proof of a spend-control layer is
that the *cap* held, and that works against any merchant. What a judge cannot see here is
us earning from our own service.

## Run it yourself

```bash
git clone https://github.com/unifyWeb3/capsule.git && cd capsule
npm install
cp .env.example .env          # add SERV_API_KEY from console.openserv.ai
npm test                      # 11 tests
npm start                     # Scout on :8080
```

To run the agent you need three things this repository cannot provide: a SERV API key, a
Kite Passport agent with a runtime key, and a spending session approved with a passkey.

```bash
kpass agent init
kpass agent create --uid capsule-agent --kind buyer --name Capsule --url https://<host>
kpass agent token create --agent <agent-id>
kpass agent bind --agent <agent-id> --token <token>

kpass session create --separate \
  --task-summary "Capsule demo: buy market data under a user-signed spending cap" \
  --max-amount-per-tx 0.002 --max-total-amount 0.0025 --ttl 168h --assets USDC

npm run menu                  # the catalog the agent may buy from
npm run demo                  # one task, end to end, writes docs/receipts.json
npm run claims                # regenerates docs/CLAIMS.md from the run
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

- **The pilot's caps are tiny** — $0.002 per call, $0.0025 in total. The scale is set by
  a small test wallet, not by the design. The mechanism does not care about the magnitude.
- **Our own service could not be paid.** Its host is not on the Passport's allowlist, so
  the run buys from third-party merchants and we earn nothing. See above.
- **The settlement chain is Base, not Kite chain.** Kite Passport is multichain and the
  wallet that funded the run holds USDC on Base, so settlement is direct and costs no
  bridge. Settling on Kite chain instead is a configuration change, not a redesign, but
  it is untested here.
- **The agent's endpoint choices come from a curated menu**, not the whole catalog, and
  its subject parameters are fixed by the menu builder rather than chosen per run.
- **The seller's data is partly derived** in Scout. The catalog merchants' own data is
  theirs.
- **One task, one agent, one session.** No multi-agent orchestration, no retry policy, no
  database, no queue.
- **The KYC record for the account is still pending review.**

## Disclosures

- Built with [SERV Reasoning](https://docs.openserv.ai/serv-reasoning/introduction) and
  [Kite Agent Passport](https://docs.gokite.ai/passport).
- The agent, the proof endpoint, the registry and Scout are ours. The x402 protocol, the
  Pieverse facilitator, the Kite service catalog, the catalog merchants (Otto AI,
  Agent402 Tools, Google Trends via x402Atlas) and CoinGecko are not.
- The private keys for Scout and the agent live outside this repository, and the agent's
  runtime key is what makes its spending attributable to its DID.
- Prices are quoted in USDC and settle on the chain named in the x402 challenge.

## Licence

MIT.
