# Event rules — SERV Hackathon, Edition 02

Captured 2026-11-11 from the official pages, not from memory. Every value below
names where it came from. Unresolved items are in **Open questions** at the
bottom, not guessed here.

## Event

| Item | Value |
| --- | --- |
| Event name | SERV Hackathon — Edition 02 |
| Official URL | https://www.openserv.ai/hackathon-2 (published Nov 6 2026, 14:02 UTC) |
| Sponsor / platform | OpenServ — the reasoning engine is **SERV Reasoning** (base URL `https://inference-api.openserv.ai/v1`) |
| Prize structure | $5,000 total across tracks. Per-track breakdown **not published** — page shows `track_winner × 2`, `best_overall_build`, `special_mention`, all `TBA`, and "breakdown announced at kickoff" |
| Submission opens | Nov 2, 2026 (kickoff) |
| Deadline | **Nov 15, 2026, 23:59 UTC** |
| **Total time budget** | 4 days as of this capture (Nov 11 → Nov 15) |
| **Phase split derived from the budget** | 0 toolchain 5% · 1 rules+field 10% · 2 product 15% · 3 build 45% · 4 audit 10% · 5 demo 5% · 6 freeze 7% · 7 submit 3% |
| Judging model | Judged on three named criteria: **creativity, user readiness, revenue potential**. No published weights |
| Screening before scoring | Not stated. Edition 01 says "Each track is judged over the following week" and winners announced later |
| Submission order effect | None published. Edition 02 is a fixed-window event (Nov 2–15), unlike DoraHacks first-come rounds |
| Editable after submitting | Not stated |
| Required build tool or platform, and how it is verified | **SERV Reasoning must be part of the build in every track, including Kite.** Verified by the write-up field ("how it uses SERV Reasoning") and the track copy ("Every track needs to use SERV Reasoning"). The write-up is the verification surface; the judge reads it |
| Track entered | **Track 02 — Kite** |

### Kite track brief (verbatim from the event page)

> Build agents with a verifiable identity and spending limits you control, so it
> can shop, book, and pay on your behalf, safely.

Partner docs: https://docs.gokite.ai/passport
Priority open-source repos named by the organizer:

- https://github.com/CarryWang/kite-x402-explorer
- https://github.com/BrKDDD/kite-x402-hono
- https://github.com/tianzeshi-study/kite-x402-axum
- https://github.com/gokite-ai/kite_counter_dapp

## Rubric and gates

Edition 02 publishes **no weights**. Two scoring layers therefore apply: the
event's three named criteria (unweighted, authoritative) and the default
benchmark below (weighted, used for gap routing).

### Layer A — the event's own criteria

| Criterion (verbatim) | Weight | Our plan | Evidence we will produce | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| Creativity | not published | **The price of a limit**, measured by a controlled experiment: the same task, the same agent, one number changed | `docs/PROVENANCE.md`, the two runs on `/runs`, the README's first paragraph | builder | **ready** |
| User readiness | not published | A judge opens one URL and reads the whole record, with no keys and no setup | `capsule-phi-blond.vercel.app` — the record, `/runs`, `/verify`, `/docs/security-model` | builder | **ready** |
| Revenue potential | not published | One payer (the operator who sets the cap), one number (per-agent monthly, a share of the capped spend), one path to charge (the x402 merchant already in this repository) | README's business model; `/v1/*` settles USDC on Base | builder | **stated as a hypothesis — no customer yet** |
| Required platform: SERV Reasoning used in the build | gate, not scored | SERV Reasoning is the decision layer: it names the endpoint and the fact for every attempt | `src/serv.ts`, `src/agent.ts`; the model's own reasoning for each attempt is in the signed log | builder | **ready** |
| Track: Kite — verifiable identity + user-controlled spending limits | gate, not scored | Agent identity + per-session cap enforced by Kite Passport, not by our code | The session id and both caps are **inside the hash chain**; the head is signed with the key Kite publishes for the DID | builder | **ready** |

### Layer B — default benchmark (event publishes no weights, so this applies)

Weights used: impact 30 · technical execution 20 · innovation 15 · demo & evidence 15 · product & UX 10 · sponsor tech 10. Total 100. Every sub-score needs a citation.

| Dimension | Weight used | Score | Citation that earns it |
| --- | --- | --- | --- |
| Impact on the user | 30 | 17 | A number no one else in the field can produce: **$0.051 of evidence against a $0.0025 budget — 20.4×** — from a real run, with the same endpoint paid under a larger cap (`0xd769e940…`). Minus: the served user is still us; nobody else's agent has been verified through `/verify` yet, and no revenue exists |
| Technical execution | 20 | 16 | Live chain re-reads (138 848 and 138 742 confirmations), hash chain intact, the signature recovers to `0x5512caEe…` against Kite's published key, 38/38 tests, 15/15 live checks, a reproducible deploy. Minus: the decision-path latency is not captured, and the transport log post-dates the recorded run |
| Innovation | 15 | 12 | The price of a limit, plus a genuine controlled experiment — one variable changed, different outcome, the field's only experiment. Minus: the set-cover solver is unbuilt and its coverage model is declared rather than demonstrated |
| Demo and evidence | 15 | 10 | Live URL, `/proof.json`, real tx hashes, explorer links, a generated claims registry, two runs with an A/B screen, a published log, an interactive trace. Minus: the video and the X posts are not out, and the reasoning trail's transport metadata was never captured for the recorded run |
| Product and UX | 10 | 6 | One visual system across eight pages, no overflow at 1440/390, contrast ≥4.5, a data layer the pages cannot bypass. Minus: the cap calculator is unbuilt and the run pages are two static documents |
| Sponsor technology use | 10 | 7 | SERV Reasoning genuinely decides which endpoint and which fact for every attempt, and its reasoning is in the signed log. Minus: the transport log (tokens, latency) is not surfaced |
| **Total** | **100** | **68** | |

## Required submission fields

Source: the live Typeform `https://openserv.typeform.com/submissions02`, parsed
from the page's own field JSON on 2026-11-11. 21 fields, 12 required.

| # | Field | Required | Value we will submit | Verified link or artifact | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Full name | yes | | | pending |
| 2 | Email | yes | | | pending |
| 3 | Are you new to building with OpenServ? | yes | | | pending |
| 4 | Which track are you submitting to? | yes | `Kite` | | ready |
| 5 | New project, or existing project with new work? | yes | | | pending |
| 6 | What is your project called? | yes | | | pending |
| 7 | Tell us about your project — what it does, who it is for, what problem it solves, how it works | yes | | | pending |
| 8 | Project URL (demo / website / GitHub) | yes | | | pending |
| 9 | X post URL about the project | yes | | | pending |
| 10 | One additional project URL | no | | | pending |
| 11 | Project logo or icon | no | | | pending |
| 12 | Is data collection enabled for your project? | yes | | | pending — **eligibility gate** |
| 13 | Which best describes your team? | yes | | | pending |
| 14 | How much experience do you have building AI agents? | no | | | pending |
| 15 | Country | no | | | pending |
| 16 | Company or school | no | | | pending |
| 17 | Current role | no | | | pending |
| 18 | LinkedIn or GitHub profile, or personal site | no | | | pending |
| 19 | What has your experience with SERV been like? | no | | | pending |
| 20 | May we share feedback as a quote? | no | | | pending |
| 21 | Would you like to receive OpenServ updates? | no | | | pending |

Additional requirements not captured by a form field:

- The X post must **tag @openservai** (stated in the form's own field description
  and in the form banner: "Tag @openservai in your post before you submit").
- FAQ requires "a public code repository, a demo link or video, and a short
  write-up". The write-up is field 7. The demo link is field 8. A video is
  accepted but not a separate form field — use field 10 for it if there is one.
- **Do not submit on the strength of the skill alone.** Submission is an
  authorized action and is the last step.

## Eligibility

| Requirement | Met | Evidence |
| --- | --- | --- |
| OpenServ account and API key | **yes** | `SERV_API_KEY` is set in `.env`; `src/serv.ts` calls `https://inference-api.openserv.ai/v1/chat/completions` |
| Data collection enabled at console.openserv.ai/settings/organization | **yes** | The user confirmed it enabled, 2026-11-12 |
| Built with SERV Reasoning | **yes** | The reasoning layer picks the endpoint and the fact for every attempt — `src/serv.ts`, `src/agent.ts` |
| Track is Kite | yes | |
| Public repository | **yes** | `github.com/unifyWeb3/capsule`, public (`private: false`) |
| Demo link or video | **partly** | The live app is the demo link: `https://capsule-phi-blond.vercel.app`. The 90-second video is still the user's |
| X post tagging @openservai | no | Needs the user's X account. Two posts are drafted in `docs/SUBMISSION.md` |
| Submissions close Nov 15 2026 23:59 UTC | — | 4 days from capture |

## Competitive field

| Item | Value |
| --- | --- |
| Entries in the field, and how winners were decided | Edition 02 has no public submission list (Typeform form, not DoraHacks). Edition 01 (14–28 Sep 2026) had **70+ submissions** across 4 tracks, 4 track winners + 1 best-overall + 1 honourable mention. Each track judged over the following week on creativity, user readiness, revenue potential |
| Prior winners inspected, with links | Edition 01 winners: ASSAY (best overall, Open Track, @\_OoJae), Shijima (Robinhood Mainnet & MCP, @Chain\_Oracle), Payrun (Coinbase AgentKit, @willIsbillls), CapitalRail (IXS RWA Vaults, @thybow1), SERVPIT (Open Track HM, @25THPRMR). Kite AI Global Hackathon 2026 (Mar 27 – Apr 26 2026, with Encode Club; finale Jul 9 2026): Flattora, Quittance, WasiAI A2A Gateway, ORCA, Kutip, NEXUS, NegotiatorGrid, Kite Garden |
| Axes where winners were a near-universal subset | None found in metadata. On the closest comparable round (Arc Microgrants 2, 288 submissions, 8 winners) **no single extracted axis cleanly separated winners**: demo video 7/8 winners vs 61.8% field, contract address in description 7/8 vs 67.0%, tx hash 7/8 vs 48.6%, Arc Studio link 2/8 vs 16.0%, explorer link in the links array **0/8** vs 4.9%. The winners put addresses and tx hashes in the description prose, not in links |
| Axes common across the whole field (noise) | Video (61.8%), GitHub repo (99.3%), live demo URL (89.9%), USDC mentioned (92.7%), submission order (winners spread across all deciles), prize size (flat $500) |
| Approach the field has converged on | Agents that decide something and then move or guard real money, with a deterministic verification layer between the model and the wallet, and a ledger of receipts. Almost every Edition 01 featured post has the same shape: "model proposes, code decides", live Vercel demo, public repo, real transaction link, a named SERV feature (Prompt Guard / Shadow Agent / JEV / Multipath / Kronos) |
| Open axis we will take | **The spend limit must be enforced by a key the user holds, not by code we wrote.** Evidence: the closest analog in the whole field, Tender (`github.com/Odera067/Tender`, Edition 01 **AgentKit track**, a track winner) is "an agent that pays for exactly the data it needs, and no more" — and its entire limit story is a self-implemented `BudgetGuard` in our own repo: a hardcoded total budget, a per-call cap, a max purchase count, origin/network/token/recipient allowlists, and a no-double-buy rule. Every edition-01 entry does the same thing: the agent caps itself. The Kite track is the one track where the cap can be someone else's — a passkey-approved session with a per-transaction and total limit, on a separate chain, that our code cannot exceed. No Edition 01 entry takes that axis |
| One sentence: on which axis do we beat the field? | TBD — must be written before the build starts. Candidate: "Tender caps the agent with code it wrote itself; ours caps it with a key the user holds, and the receipt proves it." Needs the weakest-part pass before it is adopted |
| Structures taken from prior winners | Live demo URL, public repo, one-sentence bold claim, real transaction link, a named "model proposes / code decides" separation, a receipt or ledger, X post with the hashtag and tag |
| Winning README shapes, verified in the winners' own repos | Tender: bold claim → capability table (Reasoning / Guardrail / Wallet / Payments) → ASCII "model proposes, code decides" diagram → enumerated guard rules → a table of "different questions stop at different depths" with spend amounts → clean-checkout commands. EXHIBIT A: bold claim → Live + demo video links → **"Judge it in 60 seconds"** numbered walkthrough → Mermaid diagram with *code* vs **SERV** boxes → "every SERV call is logged in the UI's audit trail: model, features, tokens, latency, cost" → a **Business model** section → a **Run it** section → a Layout section with file paths → an honest-limitations note. Judr: badge strip, CI badge, live badge, `/api/` endpoints, a proof page, audit trail, business model, `npm install`, `basescan` address and tx links |
| Ideas, designs, interfaces, or copy we did not take | Nothing yet — Phase 2 |

## Deployment and cost

| Item | Value |
| --- | --- |
| Deployment target and plan | **Vercel**, as the Edition 01 winners overwhelmingly did. `vercel.json` names the entry point; `.vercelignore` keeps the private keys out of the uploaded source. Vercel Hobby is **non-commercial personal use only**, which is fine for a hackathon entry |
| Public URL and subdomain | `https://capsule-phi-blond.vercel.app` (Vercel project `oxunify/capsule`) |
| Verified limits that matter | TBD — verify against current Vercel / Cloudflare Pages docs before choosing |
| Restriction that could bite | Vercel Hobby non-commercial clause; build timeouts; free-tier usage pauses |
| Recurring cost and who pays | $0 expected for a static demo. Agent API calls cost SERV credits, not cash |
| Sponsor allowance | **$5 in SERV credits** for pre-registered participants (event FAQ). Kite track may carry its own allowance — unconfirmed |
| Environment variables | `SERV_API_KEY` (OpenServ), Kite Passport credentials, any chain RPC key. **Never committed** |
| Verified how, and on what date | — |

## Benchmark and gap routing

| Dimension | Weight used | Score | Citation that earns it |
| --- | --- | --- | --- |
| Impact on the user | 30 | | |
| Technical execution | 20 | | |
| Innovation | 15 | | |
| Demo and evidence | 15 | | |
| Product and UX | 10 | | |
| Sponsor technology use | 10 | | |
| **Total** | **100** | | |

| Gap | Lever that closes it | Cost in time | Applied? | Score delta |
| --- | --- | --- | --- | --- |
| The third-party path could not show the headline number — the published log carried no session, so `budget_multiplier` was null | Put the session **inside the hash chain**, re-chain, re-sign the new head | 45 min | **yes** | +2 impact, +1 demo |
| The network effect was built and not claimed | State it: *"verifies **any** agent's spending record; the payments are chain-verified, the refusals are the author's claim, the hash chain is a bonus"* | 20 min | **yes** | +2 impact, +1 product |
| The A/B — the strongest evidence — had no screen | Publish the contrast log; `/runs` and `/runs/:id` | 1.5 h | **yes** | +3 demo, +1 impact |
| The check was a JSON blob, which asks for trust instead of teaching it | `/verify` as an interactive trace, step by step | 1.5 h | **yes** | +2 product, +2 demo |
| SERV Reasoning was in the loop but invisible | The model's own reasoning per attempt, from the signed log, plus the transport trail captured for future runs | 1 h | **yes** (reasoning) / **no** (transport, for the recorded run) | +2 sponsor, +1 demo |
| A DNS-rebinding window in the third-party fetcher | Resolve once, connect to the address that was checked | 1 h | **yes** | +1 technical, +1 impact |
| The refusals are the owner's claim | An attestation transaction per refusal | — | **no** — needs a wallet and gas | would close the one asymmetry |
| Nobody can compute the cost of a limit for *their* agent | A cap calculator: exact min-cost set cover over the live catalog, with declared and demonstrated coverage kept apart | 3 h | **no** — the coverage model needs a decision first | up to +3 innovation |

Deliberately left undone, and why: the adapter restructure the blueprint proposed
(`core/` + `adapters/`, 4 h) was cut — `src/verify-log.ts` already reuses `ChainReader`
and `verifyStep`, so the duplication it removes is about forty lines, and the outcome a
third party actually experiences is delivered by the published log format and its writer,
which is a third of the cost. The set-cover calculator is the one item worth its hours,
and it needs a decision about how coverage is measured before it is built.

## Open questions

| Question | Owner | Needed by | Status |
| --- | --- | --- | --- |
| OpenServ account, API key, and $5 credit balance | user | day 1 | blocked |
| Data collection enabled in console settings | user | before submission | blocked |
| Kite Passport signup + passkey + funded USDC.e wallet on Kite chain | user | day 1 | blocked |
| X account able to post tagging @openservai | user | day 3 | blocked |
| Per-track prize breakdown and any Kite-specific challenge detail | organizer | when announced | open |
| Exact time budget in hours (4 days assumed) | user | day 1 | assumed |
| Whether Edition 02 requires data collection enabled, as Edition 01 did | organizer / console | day 1 | open |
