# Account setup — your steps, in order

Everything here needs your hands: an email link, an OTP, a passkey, and a crypto
transfer. I cannot do any of it for you. `kpass` 6.13.2 is already installed and its
backend is reachable (`https://passport.prod.gokite.ai`, v4.0.13, status ok).

Run these in your own terminal and paste me the output of the **bold** lines. I will
not create accounts, request OTPs, or move money without your say-so.

---

## A. OpenServ (blocks the build — I cannot call SERV without it)

1. Sign up: <https://console.openserv.ai/signup>
2. Create an API key in the console. **Do not paste it into chat.** Write it to the
   repository's own env file, which is gitignored:

   ```bash
   cd /home/unify/serv
   printf 'SERV_API_KEY=...\n' >> .env
   chmod 600 .env
   ```

   The npm scripts load `.env` natively (`node --env-file-if-exists=.env`), so the key
   is never in a shell profile, never in chat, and never committed. I read it from the
   environment at run time and never print it.
3. **Enable data collection**: <https://console.openserv.ai/settings/organization>
   — this is an eligibility gate in the Edition 01 FAQ and the Edition 02 form asks the
   same question. Do this now, it is the thing most likely to disqualify us late.
4. Check your credit balance. **The account currently holds $1 of SERV credits**, not
   the $5 the FAQ mentions. That decides the reasoning budget, and the agent already
   makes exactly two SERV calls per run (one to decide, one to answer). At $1 that is
   a large number of full runs, so the budget is not the binding constraint — the
   deadline is.

## B. Kite Passport (blocks the money path)

### B1. Sign in

`kpass signup init --email akoladefatoki108@gmail.com` has already been run. It only
*started* the flow: `~/.kite-passport/config.json` holds the email but no JWT, and
`kpass status` still reports `logged_in: false`. Two steps remain — open the emailed
link, then finish the exchange:

```bash
kpass signup poll --signup-id <id> --wait --output json
kpass signup exchange --signup-id <id> --code <code> --output json
kpass status --output json   # expect logged_in: true
```

The signup id and the code come from the link Kite emailed you. If the link has
expired, `kpass login init --email akoladefatoki108@gmail.com` sends a fresh one.

If you already have an account, `kpass login init --email you@example.com` then
`kpass login verify --login-id <id> --code <code>`.

**Then send me:** `kpass status --output json` (it should show an active session).

### B2. Create a passkey

<https://agentpassport.ai/dashboard> → it asks for Touch ID / Face ID / Windows Hello /
a hardware key. This is the step that makes the spending cap yours rather than the
agent's, and it is the spine of the whole entry.

### B3. Fund the wallet with USDC.e on Kite chain

You said you already hold USDC and will bridge it yourself — no new spend from me. Two
paths:

- **Direct deposit.** Dashboard → **Crypto** tab → copy the **Kite USDC** (USDC.e on
  Kite chain) address. Send USDC.e from your own wallet on Kite chain. You need a
  little **KITE** for gas on that transfer.
- **From another chain.** Dashboard → Crypto tab gives a deposit address per chain:
  Base, Polygon, Avalanche, Tempo, Solana, PYUSD, Robinhood USDG, **Arc USDC**, or
  Kite USDC. If your USDC is on Base or Arc, send it to that chain's listed address.
  You can also use <https://bridge.gokite.ai>.

**Then send me:** `kpass wallet balance --output json` — confirm a non-zero USDC.e
balance **on the kite chain**. The wallet is currently `0.000000` on every chain.
The demo needs the $0.30 for the session; $1 is comfortable, $5 is generous.

## C. Agent identity (I can run this once you are signed in)

I will run these — say go:

```bash
kpass identifier claim                 # one-time controller identifier
kpass onboarding submit                # account KYC/KYB — needed by agent create
kpass agent init                       # the agent's secp256k1 runtime key
kpass agent create --uid <slug> --kind buyer --name "..." --description "..." \
                   --url https://<our-vercel-domain> --visibility listed
kpass agent token create               # single-use runtime bind token
kpass agent bind --agent <ref> --token art_...   # lands active
```

**Ask Kite support or check whether `onboarding submit` needs manual review.** If
onboarding is slow, that is on the critical path — tell me the status and I will
re-plan around it.

## D. The spending session (needs your passkey, one time)

Once the agent is bound and the wallet is funded:

```bash
kpass session create --separate \
  --task-summary "Capsule demo run: market-data purchases under a capped session" \
  --max-amount-per-tx 0.25 \
  --max-total-amount 0.30 \
  --ttl 24h --assets USDC --output json
```

That prints an **approval URL**. Open it on the device where your passkey lives and
approve. Then:

```bash
kpass session status --request-id <id> --wait --output json
kpass session use --session-id <id>
```

**The limits must match the catalogue prices.** The four paid tiers are $0.05
(`/v1/snapshot`), $0.20 (`/v1/history`), $0.50 (`/v1/deep`) and $1.20 (`/v1/briefing`).

| Session | What happens |
| --- | --- |
| per-tx $0.02, total $0.05 | **Every tier is refused. Zero payments. The demo is empty.** |
| per-tx $0.25, total $0.30 | Buys $0.05, buys $0.20, then attempts $0.50 and **the session refuses it** — over the per-transaction cap and over the $0.05 left. That refusal is the demo. |

Use the second. It costs **$0.30 of USDC.e**, and the run spends $0.25 of it.

## E. The X post

Posting is required and the post must tag **@openservai**. I will draft the text and
give you the exact post; you publish it and send me the URL. The form needs the URL as
a required field.

---

## Where things live

| Thing | Where | Who |
| --- | --- | --- |
| `SERV_API_KEY` | `/home/unify/serv/.env`, chmod 600, gitignored — never in chat | you |
| Kite user JWT | `~/.kpass/config.json` (the CLI writes it) | you |
| Agent runtime key | `<repo>/.kite-passport/runtime.key`, mode 0600 — **gitignored** | the CLI |
| Agent + session state | `<repo>/.kite-passport/agent.json` — **gitignored** | the CLI |
| Deployed app | Vercel env vars, set at deploy time | you, or I with your authorization |

`.kite-passport/` must be in `.gitignore` before the first commit that includes the
agent directory. The runtime key is the agent's whole identity — treat it like a private
key.

## What I will not do without asking

Create accounts, request or read an OTP, approve a passkey, move funds, deploy, create
the GitHub repository, or submit. I will prepare each of those and hand you the exact
command.
