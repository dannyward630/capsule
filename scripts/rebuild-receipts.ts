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
import { computeCounterfactual } from "../src/counterfactual.js";
import { loadMenu } from "../src/menu.js";

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

  // The running total, computed from the log's own prices. A refused purchase
  // does not move it, which is the whole point of the column.
  let running = 0;
  const steps: ReceiptStep[] = records.map((record, index) => {
    const decision = record.decision;
    if (decision.kind === "note") {
      throw new Error(`record ${index} is a note, which the run does not write`);
    }
    const payment =
      decision.kind === "purchase"
        ? payments.find((entry) => entry.url === decision.url)
        : undefined;
    if (decision.kind === "purchase") running += Number(decision.price_usd);
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
      spent_total_after: running.toFixed(4),
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

  // The task and the session are part of the artifact; a rebuild must not
  // blank them or silently bind them to a different session.
  let existingTask = "";
  let previousSession:
    | { session_id?: string | null; max_amount_per_tx?: string | null; max_total_amount?: string | null }
    | undefined;
  try {
    const previous = JSON.parse(
      await readFile(path.join(REPO_ROOT, "docs", "receipts.json"), "utf8"),
    ) as {
      task?: string;
      session?: {
        session_id?: string | null;
        max_amount_per_tx?: string | null;
        max_total_amount?: string | null;
      };
    };
    existingTask = previous.task ?? "";
    previousSession = previous.session;
  } catch {
    existingTask = "";
  }
  const logSession = records.find((record) => record.session)?.session;

  // The contrast run is merged in at build time, so the running app reads one
  // file and the deployment does not depend on a second path being uploaded.
  let contrast: Receipts | undefined;
  try {
    contrast = JSON.parse(
      await readFile(
        path.join(REPO_ROOT, "docs", "runs", "contrast", "receipts.json"),
        "utf8",
      ),
    ) as Receipts;
  } catch {
    contrast = undefined;
  }

  const receipts: Receipts = {
    ...(contrast ? { contrast } : {}),
    generated_at: records[records.length - 1]!.at,
    task: process.env.DEMO_TASK ?? existingTask,
    claim:
      "Every purchase your agent made, every one it was refused, and the price of each - refusals decided by your Passport, not by the agent.",
    session: {
      // The session that produced the log. A log written now carries it; an
      // older one does not, so the previous receipts are the fallback. The
      // *current* session is never used: it may be a different one.
      session_id: logSession?.id ?? previousSession?.session_id ?? null,
      task_summary: null,
      max_amount_per_tx:
        logSession?.max_amount_per_tx ?? previousSession?.max_amount_per_tx ?? null,
      max_total_amount:
        logSession?.max_total_amount ?? previousSession?.max_total_amount ?? null,
      assets: null,
    },
    payer_address: await kpass.walletAddress(
      process.env.SETTLEMENT_CHAIN === "kite" ? "kite" : "base",
    ),
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
    counterfactual: computeCounterfactual({
      records,
      facts: (process.env.DEMO_FACTS ?? "").split(";").filter(Boolean),
      menu: await loadMenu(),
      budgetUsd: Number(session?.max_total_amount ?? 0),
    }),
    substitutions: substitutions(records),
    steps,
    totals: {
      payments: purchases.length,
      refusals: refusals.length,
      spent_usd: spent.toFixed(4),
      session_budget_usd:
        logSession?.max_total_amount ??
        previousSession?.max_total_amount ??
        session?.max_total_amount ??
        "0",
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
