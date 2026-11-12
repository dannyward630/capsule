/**
 * Runs one task end to end and writes the evidence.
 *
 * The decision log is the artifact: every attempt is appended as it happens, and
 * the receipts file is derived from that log rather than assembled beside it.
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Agent } from "../src/agent.js";
import { Kpass } from "../src/kpass.js";
import { ServClient } from "../src/serv.js";
import { REPO_ROOT, type Receipts } from "../src/proof.js";
import { chainByName } from "../src/kite.js";
import {
  DecisionLog,
  HASH_ALGORITHM,
  substitutions,
  split,
} from "../src/log.js";
import { fetchPublishedKeys, signLog } from "../src/attest.js";

const TASK =
  process.env.DEMO_TASK ??
  "Give me a cautious assessment of ETH: what is it trading at, how has it trended over the last month, how volatile is it, and what are the main risks right now?";

const REQUIRED_FACTS = (
  process.env.DEMO_FACTS ??
  "current ETH price and 24h change;sentiment and recent headlines;search interest and trend over the last month;volatility and drawdown;main risk factors"
).split(";");

async function main() {
  const chain = chainByName(process.env.SETTLEMENT_CHAIN ?? "base");
  const seller = JSON.parse(
    await readFile(path.join(REPO_ROOT, "docs", "seller.json"), "utf8"),
  ) as { address: string };

  const kpass = new Kpass({ cwd: REPO_ROOT, sessionId: process.env.KPASS_SESSION_ID ?? null });
  const serv = new ServClient();
  const log = new DecisionLog();
  const agent = new Agent(
    {
      task: TASK,
      requiredFacts: REQUIRED_FACTS,
      budgetUsd: Number(process.env.DEMO_BUDGET ?? "0.02"),
      log,
    },
    kpass,
    serv,
  );

  console.log(`\ntask:   ${TASK}`);
  console.log(`facts:  ${REQUIRED_FACTS.join(" | ")}`);
  console.log(`chain:  ${chain.network} (${chain.assetSymbol})\n`);

  const menu = await agent.loadMenu();
  console.log(`menu:   ${menu.endpoints.length} paid endpoints on ${menu.source}\n`);

  const run = await agent.run();

  const records = await log.read();
  const chainCheck = await log.verifyChain();
  const { purchases, refusals } = split(records);
  if (!chainCheck.ok) {
    throw new Error(
      `the decision log is broken at record ${chainCheck.brokenAt}: ${chainCheck.reason}`,
    );
  }

  // The agent signs its own record with the key the Passport binds to its DID,
  // so a third party can check the record against the Passport's own copy.
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
    generated_at: new Date().toISOString(),
    task: TASK,
    claim:
      "Every purchase your agent made, every one it was refused, and the price of each - refusals decided by your Passport, not by the agent.",
    session: {
      session_id: run.session.session_id,
      task_summary: null,
      max_amount_per_tx: run.session.max_amount_per_tx,
      max_total_amount: run.session.max_total_amount,
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
    seller: {
      name: "Kite service catalog",
      pay_to: seller.address,
    },
    attestation,
    published_key,
    log: {
      algorithm: HASH_ALGORITHM,
      path: path.relative(REPO_ROOT, log.path),
      records: records.length,
      head: chainCheck.head,
      verified: chainCheck.ok,
    },
    substitutions: substitutions(records),
    steps: run.steps,
    totals: {
      payments: purchases.length,
      refusals: refusals.length,
      spent_usd: run.session.spent_total ?? "0",
      session_budget_usd: run.session.max_total_amount ?? "0",
    },
  };

  await mkdir(path.join(REPO_ROOT, "docs"), { recursive: true });
  await writeFile(
    path.join(REPO_ROOT, "docs", "receipts.json"),
    `${JSON.stringify(receipts, null, 2)}\n`,
  );

  console.log("\n--- decisions ---");
  for (const record of records) {
    if (record.decision.kind === "purchase") {
      console.log(
        `  ${record.seq}. paid    $${record.decision.price_usd.padEnd(6)} ${record.decision.service}${record.decision.tx_hash ? `  tx=${record.decision.tx_hash.slice(0, 12)}...` : ""}`,
      );
    } else if (record.decision.kind === "refusal") {
      console.log(
        `  ${record.seq}. refused $${record.decision.price_usd.padEnd(6)} ${record.decision.service}  (${record.decision.error_code})`,
      );
    }
  }
  console.log(
    `\nspent ${receipts.totals.spent_usd} of ${receipts.totals.session_budget_usd} budget, ` +
      `${receipts.totals.payments} paid, ${receipts.totals.refusals} refused`,
  );
  console.log(`log:   ${records.length} records, ${HASH_ALGORITHM}, head ${chainCheck.head?.slice(0, 14)}...`);
  console.log(`facts covered: ${run.coveredFacts.length}/${REQUIRED_FACTS.length}`);
  if (run.missingFacts.length) {
    console.log(`facts missing: ${run.missingFacts.join(", ")}`);
  }
  console.log(`\n--- answer ---\n${run.answer}\n`);
  console.log("receipts written to docs/receipts.json");
}

await main();
