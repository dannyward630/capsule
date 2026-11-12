/**
 * Rebuilds docs/receipts.json from the decision log and the Passport's own
 * record of the session.
 *
 * The log is the artifact. This script proves it: it re-derives the receipts
 * from the hash chain and the session the CLI can still read, so the evidence
 * can be regenerated without spending anything again.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Kpass } from "../src/kpass.js";
import { DecisionLog, HASH_ALGORITHM, substitutions, split } from "../src/log.js";
import { REPO_ROOT, type Receipts, type ReceiptStep } from "../src/proof.js";
import { chainByName } from "../src/kite.js";
import { fetchPublishedKeys, signLog } from "../src/attest.js";

async function main() {
  const log = new DecisionLog({ path: path.join(REPO_ROOT, "docs", "decision-log.jsonl") });
  const records = await log.read();
  if (!records.length) {
    console.log("the decision log is empty; nothing to rebuild");
    return;
  }
  const chainCheck = await log.verifyChain();
  if (!chainCheck.ok) {
    throw new Error(
      `the decision log is broken at record ${chainCheck.brokenAt}: ${chainCheck.reason}`,
    );
  }

  const kpass = new Kpass({ cwd: REPO_ROOT });
  const session = await kpass.currentSession();
  const payments = await kpass.payments();
  const chain = chainByName(process.env.SETTLEMENT_CHAIN ?? "base");
  const seller = JSON.parse(
    await readFile(path.join(REPO_ROOT, "docs", "seller.json"), "utf8"),
  ) as { address: string };

  const steps: ReceiptStep[] = records.map((record, index) => {
    const decision = record.decision;
    if (decision.kind === "note") {
      throw new Error(`record ${index} is a note, which the run does not write`);
    }
    const payment =
      decision.kind === "purchase"
        ? payments.find((entry) => entry.url === decision.url)
        : undefined;
    return {
      n: index,
      url: decision.url,
      endpoint: `${decision.service}`,
      price_usd: decision.price_usd,
      outcome: decision.kind === "purchase" ? "paid" : "refused",
      http_status: decision.kind === "purchase" ? 200 : null,
      error_code: decision.kind === "refusal" ? decision.error_code : null,
      error_message: decision.kind === "refusal" ? decision.message : null,
      tx_hash: decision.kind === "purchase" ? (decision.tx_hash ?? payment?.txHash ?? null) : null,
      session_id: session?.session_id ?? null,
      spent_total_after: null,
      paid_at: decision.kind === "purchase" ? record.at : null,
    };
  });

  const { purchases, refusals } = split(records);
  const spent = purchases.reduce(
    (total, record) =>
      total + (record.decision.kind === "purchase" ? Number(record.decision.price_usd) : 0),
    0,
  );

  const did = process.env.KPASS_AGENT_DID ?? "did:kite:ind-akoladefatoki108:capsule-agent";
  let attestation: Receipts["attestation"] = null;
  let published_key: Receipts["published_key"] = null;
  try {
    const keys = await fetchPublishedKeys(did);
    const key = keys.find((candidate) => candidate.active) ?? keys[0] ?? null;
    published_key = key;
    attestation = await signLog({
      head: chainCheck.head ?? "",
      did,
      keyId: key?.key_id ?? null,
      records: records.length,
      chain: chain.network,
    });
  } catch (error) {
    console.error(`warning: the attestation could not be signed: ${String(error)}`);
  }

  const receipts: Receipts = {
    generated_at: records[records.length - 1]!.at,
    task: process.env.DEMO_TASK ?? "",
    claim:
      "Every purchase your agent made, every one it was refused, and the price of each - refusals decided by your Passport, not by the agent.",
    session: {
      session_id: session?.session_id ?? null,
      task_summary: null,
      max_amount_per_tx: session?.max_amount_per_tx ?? null,
      max_total_amount: session?.max_total_amount ?? null,
      assets: null,
    },
    agent: {
      agent_id:
        process.env.KPASS_AGENT_ID ?? "agent_01a1cbf8-be0f-70af-88a8-d82d7c85564c",
      address: "0x5512caEe289ef639CD3181487F93920C5F544868",
    },
    chain: {
      network: chain.network,
      chain_id: Number(chain.network.split(":")[1]),
      asset: chain.assetAddress,
      symbol: chain.assetSymbol,
      explorer: chain.explorerUrl,
    },
    seller: { name: "Kite service catalog", pay_to: seller.address },
    attestation,
    published_key,
    log: {
      algorithm: HASH_ALGORITHM,
      path: "docs/decision-log.jsonl",
      records: records.length,
      head: chainCheck.head,
      verified: chainCheck.ok,
    },
    substitutions: substitutions(records),
    steps,
    totals: {
      payments: purchases.length,
      refusals: refusals.length,
      spent_usd: spent.toFixed(4),
      session_budget_usd: session?.max_total_amount ?? "0",
    },
  };

  await writeFile(
    path.join(REPO_ROOT, "docs", "receipts.json"),
    `${JSON.stringify(receipts, null, 2)}\n`,
  );
  console.log(
    `docs/receipts.json rebuilt from the log: ${records.length} records, head ${chainCheck.head?.slice(0, 14)}...`,
  );
}

await main();
