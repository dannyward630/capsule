/**
 * Runs one task end to end and writes the evidence.
 *
 * The receipts file it produces is the input to the proof page. Every number in
 * it comes from the CLI's own output, never from this script's arithmetic.
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Agent } from "../src/agent.js";
import { Kpass } from "../src/kpass.js";
import { ServClient } from "../src/serv.js";
import { REPO_ROOT, type Receipts } from "../src/proof.js";
import { chainByName } from "../src/kite.js";

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
  const agent = new Agent(
    {
      task: TASK,
      requiredFacts: REQUIRED_FACTS,
      budgetUsd: Number(process.env.DEMO_BUDGET ?? "0.02"),
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

  const receipts: Receipts = {
    generated_at: new Date().toISOString(),
    task: TASK,
    claim:
      "An agent that spends your money under a limit you signed - and every payment carries proof it never went over.",
    session: {
      session_id: run.session.session_id,
      task_summary: null,
      max_amount_per_tx: run.session.max_amount_per_tx,
      max_total_amount: run.session.max_total_amount,
      assets: null,
    },
    agent: {
      agent_id: process.env.KPASS_AGENT_ID ?? "agent_01a1cbf8-be0f-70af-88a8-d82d7c85564c",
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
    steps: run.steps,
    totals: {
      payments: run.steps.filter((step) => step.outcome === "paid").length,
      refusals: run.steps.filter((step) => step.outcome === "refused").length,
      spent_usd: run.session.spent_total ?? "0",
      session_budget_usd: run.session.max_total_amount ?? "0",
    },
  };

  await mkdir(path.join(REPO_ROOT, "docs"), { recursive: true });
  await writeFile(
    path.join(REPO_ROOT, "docs", "receipts.json"),
    `${JSON.stringify(receipts, null, 2)}\n`,
  );

  console.log("\n--- steps ---");
  for (const step of run.steps) {
    console.log(
      `  ${step.n}. ${step.endpoint} $${step.price_usd} -> ${step.outcome.toUpperCase()}${
        step.error_code ? ` (${step.error_code})` : ""
      }${step.tx_hash ? ` tx=${step.tx_hash.slice(0, 14)}...` : ""}`,
    );
  }
  console.log(
    `\nspent ${receipts.totals.spent_usd} of ${receipts.totals.session_budget_usd} budget, ` +
      `${receipts.totals.payments} paid, ${receipts.totals.refusals} refused`,
  );
  console.log(`facts covered: ${run.coveredFacts.length}/${REQUIRED_FACTS.length}`);
  if (run.missingFacts.length) {
    console.log(`facts missing: ${run.missingFacts.join(", ")}`);
  }
  console.log(`\n--- answer ---\n${run.answer}\n`);
  console.log("receipts written to docs/receipts.json");
}

await main();
