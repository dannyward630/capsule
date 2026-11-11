# Account setup — your steps, in order

Everything here needs your hands: an email link, an OTP, a passkey, and a crypto
transfer. I cannot do any of it for you. `kpass` 6.13.2 is already installed and its
backend is reachable (`https://passport.prod.gokite.ai`, v4.0.13, status ok).

Run these in your own terminal and paste me the output of the **bold** lines. I will
not create accounts, request OTPs, or move money without your say-so.

---

## A. OpenServ (blocks the build — I cannot call SERV without it)

1. Sign up: <https://console.openserv.ai/signup>
2. Create an API key in the console and set it in your shell:

   ```bash
   export SERV_API_KEY='...'
   ```

   Do **not** paste the key into chat or commit it. Put it in `~/.serv/.env` (chmod 600)
   or your shell profile, and I will read it from the environment.
3. **Enable data collection**: <https://console.openserv.ai/settings/organization>
   — this is an eligibility gate in the Edition 01 FAQ and the Edition 02 form asks the
   same question. Do this now, it is the thing most likely to disqualify us late.
4. Check your credit balance. Pre-registered participants get **$5** in SERV credits.
   Tell me the number — it decides how many reasoning calls the agent may make.

## B. Kite Passport (blocks the money path)

### B1. Sign in

```bash
kpass signup init --email you@example.com --output json
# open the emailed link, get the signup id and code
kpass signup poll --signup-id <id> --wait --output json
kpass signup exchange --signup-id <id> --code <code> --output json
```

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

**Then send me:** `kpass wallet balance --output json` — confirm a non-zero USDC
balance. A $5 balance is plenty for the demo; the whole run should cost well under $1.

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
  --max-amount-per-tx 0.02 \
  --max-total-amount 0.05 \
  --ttl 24h --assets USDC --output json
```

That prints an **approval URL**. Open it on the device where your passkey lives and
approve. Then:

```bash
kpass session status --request-id <id> --wait --output json
kpass session use --session-id <id>
```

The session is the artifact the whole entry rests on: `max-total-amount 0.05` with a
`0.02` per-transaction cap, so our agent **cannot** buy a $0.05 tier. That refusal is
the demo.

## E. The X post

Posting is required and the post must tag **@openservai**. I will draft the text and
give you the exact post; you publish it and send me the URL. The form needs the URL as
a required field.

---

## Where things live

| Thing | Where | Who |
| --- | --- | --- |
| `SERV_API_KEY` | `~/.serv/.env`, chmod 600 — never in the repo | you |
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
