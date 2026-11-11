/**
 * Generates docs/CLAIMS.md from live sources.
 *
 * Every number in the README, the write-up, the app, and the form comes from
 * this file. Nothing here is typed by hand: the values are read from the
 * chain, the facilitator, the CLI, the running seller, or the receipts.
 *
 *   npm run claims          regenerate docs/CLAIMS.md
 *   npm run claims -- --check   fail if the file on disk is stale
 */
import { execFile } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { CATALOG } from "../src/catalog.js";
import { FACILITATOR_URL, chainByName } from "../src/kite.js";
import { REPO_ROOT, readReceipts } from "../src/proof.js";

const exec = promisify(execFile);
const CLAIMS_PATH = path.join(REPO_ROOT, "docs", "CLAIMS.md");
const CHECK = process.argv.includes("--check");

interface Claim {
  claim: string;
  value: string;
  source: string;
  command: string;
  verified: string;
}

async function sh(command: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await exec(command, args, { maxBuffer: 8 * 1024 * 1024 });
    return stdout.trim();
  } catch {
    return "";
  }
}

async function jsonRpc(url: string, method: string, params: unknown[] = []): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = (await response.json()) as { result?: unknown; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message ?? "rpc error");
  return body.result;
}

function hexToNumber(value: unknown): number {
  return typeof value === "string" ? Number.parseInt(value, 16) : Number.NaN;
}

async function collect(): Promise<Claim[]> {
  const now = new Date().toISOString().slice(0, 10);
  const claims: Claim[] = [];
  const chain = chainByName(process.env.SETTLEMENT_CHAIN ?? "kite");

  // --- the settlement chain ---
  try {
    const id = hexToNumber(await jsonRpc(chain.rpcUrl, "eth_chainId"));
    const block = hexToNumber(await jsonRpc(chain.rpcUrl, "eth_blockNumber"));
    claims.push({
      claim: `Settlement chain is live`,
      value: `${chain.network} (chain id ${id}), latest block ${block}`,
      source: "the chain's own RPC",
      command: `curl -s -X POST ${chain.rpcUrl} -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'`,
      verified: now,
    });
  } catch (error) {
    claims.push({
      claim: "Settlement chain is live",
      value: `UNVERIFIED — ${(error as Error).message}`,
      source: "the chain's own RPC",
      command: `curl -s -X POST ${chain.rpcUrl} ... eth_chainId`,
      verified: now,
    });
  }

  // --- the facilitator ---
  try {
    const response = await fetch(`${FACILITATOR_URL}/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const body = (await response.text()).slice(0, 80);
    claims.push({
      claim: "x402 facilitator is reachable",
      value: `${FACILITATOR_URL} responded HTTP ${response.status}`,
      source: "the facilitator",
      command: `curl -s -X POST ${FACILITATOR_URL}/verify -d '{}'`,
      verified: now,
    });
    void body;
  } catch (error) {
    claims.push({
      claim: "x402 facilitator is reachable",
      value: `UNVERIFIED — ${(error as Error).message}`,
      source: "the facilitator",
      command: `curl -s ${FACILITATOR_URL}/health`,
      verified: now,
    });
  }

  // --- the Passport CLI ---
  const version = await sh("kpass", ["--version"]);
  const status = await sh("kpass", ["status", "--output", "json"]);
  let loggedIn = "unknown";
  try {
    const parsed = JSON.parse(status) as { user?: { logged_in?: boolean; email?: string | null } };
    loggedIn = parsed.user?.logged_in ? `yes (${parsed.user.email ?? "unknown email"})` : "no";
  } catch {
    // leave it unknown
  }
  claims.push({
    claim: "Kite Passport CLI version",
    value: version || "not installed",
    source: "the installed binary",
    command: "kpass --version",
    verified: now,
  });
  claims.push({
    claim: "Passport account signed in",
    value: loggedIn,
    source: "the Passport backend",
    command: "kpass status --output json",
    verified: now,
  });

  // --- the seller ---
  const sellerJson = JSON.parse(
    await readFile(path.join(REPO_ROOT, "docs", "seller.json"), "utf8"),
  ) as { address?: string; network?: string };
  claims.push({
    claim: "Seller payment address",
    value: `${sellerJson.address ?? "unknown"} on ${sellerJson.network ?? "unknown"}`,
    source: "docs/seller.json",
    command: "cat docs/seller.json",
    verified: now,
  });
  claims.push({
    claim: "Paid endpoints and prices",
    value: CATALOG.map((entry) => `${entry.path} $${entry.priceUsd}`).join(", "),
    source: "src/catalog.ts",
    command: "grep -A3 'export const CATALOG' src/catalog.ts",
    verified: now,
  });

  // --- the run ---
  const receipts = await readReceipts();
  if (receipts) {
    const paid = receipts.steps.filter((step) => step.outcome === "paid");
    const refused = receipts.steps.filter((step) => step.outcome === "refused");
    claims.push({
      claim: "Session used for the recorded run",
      value: `${receipts.session.session_id ?? "unknown"} — $${receipts.session.max_amount_per_tx} per transaction, $${receipts.session.max_total_amount} total`,
      source: "docs/receipts.json",
      command: "jq .session docs/receipts.json",
      verified: receipts.generated_at.slice(0, 10),
    });
    claims.push({
      claim: "Payments made in the recorded run",
      value: `${paid.length} paid, ${refused.length} refused, $${receipts.totals.spent_usd} spent of $${receipts.totals.session_budget_usd}`,
      source: "docs/receipts.json",
      command: "jq .totals docs/receipts.json",
      verified: receipts.generated_at.slice(0, 10),
    });
    claims.push({
      claim: "Transaction hashes",
      value: paid.map((step) => step.tx_hash ?? "none").join(", ") || "none",
      source: "docs/receipts.json",
      command: "jq '.steps[] | {endpoint, outcome, tx_hash}' docs/receipts.json",
      verified: receipts.generated_at.slice(0, 10),
    });
  } else {
    claims.push({
      claim: "Payments made in the recorded run",
      value: "UNVERIFIED — no run has been recorded yet (docs/receipts.json absent)",
      source: "docs/receipts.json",
      command: "npm run demo",
      verified: now,
    });
  }

  return claims;
}

function render(claims: Claim[]): string {
  const rows = claims
    .map((claim) => `| ${claim.claim} | ${claim.value} | ${claim.source} | \`${claim.command}\` | ${claim.verified} |`)
    .join("\n");
  return `# Claims registry

Every factual number in the README, the write-up, the app, and the submission form
comes from this file. The values are generated by \`npm run claims\`, which reads the
chain, the facilitator, the Passport backend, the seller, and the recorded run. None
of them is typed by hand.

Regenerate with \`npm run claims\`. Check with \`npm run claims -- --check\`, which
fails when this file is stale.

| Claim | Value | Source of truth | Verification command | Verified on |
| --- | --- | --- | --- | --- |
${rows}

## Claims we may not make

- Adoption, traction, or user counts that no live endpoint produces.
- "Audited", "verified", or "provable" without a command that demonstrates it.
- That the reasoning model decided something, when a deterministic rule decided it.
- Any count or amount copied from a third party without checking it in the same session.

## Unverified

Anything claimed anywhere that has no row above. This list must be empty before
submission.
`;
}

const claims = await collect();
const rendered = render(claims);

if (CHECK) {
  let current = "";
  try {
    current = await readFile(CLAIMS_PATH, "utf8");
  } catch {
    // no file yet
  }
  if (current.trim() !== rendered.trim()) {
    process.stderr.write("docs/CLAIMS.md is stale. Run: npm run claims\n");
    process.exit(1);
  }
  process.stdout.write(`docs/CLAIMS.md is current (${claims.length} claims)\n`);
} else {
  await mkdir(path.dirname(CLAIMS_PATH), { recursive: true });
  await writeFile(CLAIMS_PATH, rendered, "utf8");
  process.stdout.write(`wrote docs/CLAIMS.md (${claims.length} claims)\n`);
}
