/**
 * Stamps the session into a recorded run and re-chains the log.
 *
 * Why this exists
 * ---------------
 * The two recorded runs were written before the log carried the session that
 * was in force. That left a real gap: the log said what the agent decided and
 * what the Passport refused, but not the budget it was refused against. A
 * third party reading the published log had to be handed the budget separately
 * to be able to compute the one number the product is about — 20.4x.
 *
 * So the session is put *inside* the chain. That is strictly better than a
 * sidecar: the budget is then covered by the hash, and the head is signed with
 * the agent's key, so the cap cannot be quietly edited without breaking the
 * signature. The decisions themselves are untouched — same order, same
 * timestamps, same prices, same transaction hashes. Only the payload gains a
 * field that was true at the time.
 *
 * What it changes
 * ---------------
 * The head hash changes, because the payload changed. The old head is printed
 * and written to docs/PROVENANCE.md, so the change is visible rather than
 * silent. The attestation is re-signed for the new head by `npm run receipts`.
 *
 * Usage: `npm run stamp`
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { DecisionLog } from "../src/log.js";
import { REPO_ROOT } from "../src/proof.js";
import type { Receipts } from "../src/proof.js";

interface Run {
  name: string;
  logPath: string;
  receiptsPath: string;
  mirrorPath?: string;
}

const RUNS: Run[] = [
  {
    name: "the recorded run",
    logPath: path.join(REPO_ROOT, "docs", "decision-log.jsonl"),
    receiptsPath: path.join(REPO_ROOT, "docs", "receipts.json"),
    mirrorPath: path.join(REPO_ROOT, "docs", "decision-log.json"),
  },
  {
    name: "the contrast run",
    logPath: path.join(REPO_ROOT, "docs", "runs", "contrast", "decision-log.jsonl"),
    receiptsPath: path.join(REPO_ROOT, "docs", "runs", "contrast", "receipts.json"),
    mirrorPath: path.join(REPO_ROOT, "docs", "runs", "contrast", "decision-log.json"),
  },
];

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await (await import("node:fs/promises")).readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

interface StampResult {
  name: string;
  records: number;
  oldHead: string | null;
  newHead: string | null;
  session: { id: string | null; max_amount_per_tx: string | null; max_total_amount: string | null };
}

async function stamp(run: Run): Promise<StampResult | null> {
  const receipts = await readJson<Receipts>(run.receiptsPath);
  if (!receipts) {
    console.error(`  ${run.name}: no receipts at ${run.receiptsPath}, skipped`);
    return null;
  }
  const session = {
    id: receipts.session.session_id,
    max_amount_per_tx: receipts.session.max_amount_per_tx,
    max_total_amount: receipts.session.max_total_amount,
  };
  if (!session.id) {
    console.error(`  ${run.name}: the receipts carry no session id, skipped`);
    return null;
  }

  const log = new DecisionLog({ path: run.logPath });
  const records = await log.read();
  if (!records.length) {
    console.error(`  ${run.name}: the log is empty, skipped`);
    return null;
  }
  const oldHead = records.at(-1)!.hash;

  // A log that already carries the session is left alone: stamping twice would
  // change the head a second time for no reason.
  if (records.every((record) => record.session?.id === session.id)) {
    console.log(`  ${run.name}: already stamped, head ${oldHead.slice(0, 14)}... unchanged`);
    if (run.mirrorPath) await writeMirror(run, records);
    return {
      name: run.name,
      records: records.length,
      oldHead,
      newHead: oldHead,
      session,
    };
  }

  await log.rewrite(records.map((record) => ({ ...record, session })));

  const check = await log.verifyChain();
  if (!check.ok) {
    throw new Error(
      `the re-chained log is broken at record ${check.brokenAt}: ${check.reason}`,
    );
  }
  const newHead = check.head;
  console.log(
    `  ${run.name}: ${records.length} records stamped` +
      `  head ${oldHead.slice(0, 14)}... -> ${newHead?.slice(0, 14)}...` +
      `  session ${session.id}`,
  );

  if (run.mirrorPath) await writeMirror(run, await log.read());

  return { name: run.name, records: records.length, oldHead, newHead, session };
}

/** The JSON mirror the deployment imports, so the served log cannot drift. */
async function writeMirror(run: Run, records: unknown[]) {
  await writeFile(run.mirrorPath!, `${JSON.stringify(records, null, 2)}\n`);
  console.log(`  ${run.name}: mirror written to ${path.relative(REPO_ROOT, run.mirrorPath!)}`);
}

async function main() {
  console.log("stamping the session into the recorded runs\n");
  const results: StampResult[] = [];
  for (const run of RUNS) {
    const result = await stamp(run);
    if (result) results.push(result);
  }
  if (!results.length) {
    console.error("\nnothing was stamped");
    process.exit(1);
  }
  console.log(
    "\nnext: `npm run receipts` re-derives the receipts and re-signs the new head.",
  );
}

await main();
