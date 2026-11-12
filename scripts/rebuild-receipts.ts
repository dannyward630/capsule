/**
 * Rebuilds docs/receipts.json from the decision log.
 *
 * The log is the artifact. This proves it: the receipts are re-derived from
 * the hash chain and the session the log records, so the evidence regenerates
 * without spending anything again.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { Kpass } from "../src/kpass.js";
import { fetchPublishedKeys, signLog } from "../src/attest.js";
import { buildArtifact, readPreviousReceipts } from "../src/artifact.js";
import { loadMenu } from "../src/menu.js";
import { chainByName, DEFAULT_CHAIN_ID } from "../src/chains.js";
import { REPO_ROOT, type Receipts } from "../src/proof.js";

const DID = process.env.KPASS_AGENT_DID ?? "did:kite:ind-akoladefatoki108:capsule-agent";
const TASK =
  process.env.DEMO_TASK ??
  "Give me a cautious assessment of ETH: what is it trading at, how has it trended over the last month, how volatile is it, and what are the main risks right now?";
const CLAIM =
  "Every purchase your agent made, every one it was refused, and the price of each - refusals decided by your Passport, not by the agent.";

async function main() {
  const chain = chainByName(process.env.SETTLEMENT_CHAIN ?? DEFAULT_CHAIN_ID);
  const kpass = new Kpass({ cwd: REPO_ROOT });
  const previous = await readPreviousReceipts();
  const menu = await loadMenu();
  const facts = (process.env.DEMO_FACTS ?? "").split(";").filter(Boolean);

  let attestation = null;
  let publishedKey = null;
  try {
    const keys = await fetchPublishedKeys(DID);
    const key = keys.find((candidate) => candidate.active) ?? keys[0] ?? null;
    publishedKey = key;
  } catch {
    publishedKey = null;
  }

  const { receipts, session } = await buildArtifact({
    logPath: path.join(REPO_ROOT, "docs", "decision-log.jsonl"),
    facts,
    menu,
    chain,
    agent: {
      id: process.env.KPASS_AGENT_ID ?? "agent_01a1cbf8-be0f-70af-88a8-d82d7c85564c",
      address: "0x5512caEe289ef639CD3181487F93920C5F544868",
    },
    payer: await kpass.walletAddress(chain.id === "kite" ? "kite" : "base"),
    seller: { name: "Kite service catalog", pay_to: previous?.seller.pay_to ?? "" },
    task: previous?.task || TASK,
    claim: previous?.claim || CLAIM,
    fallbackSession: previous
      ? {
          id: previous.session.session_id,
          max_amount_per_tx: previous.session.max_amount_per_tx,
          max_total_amount: previous.session.max_total_amount,
        }
      : null,
    publishedKey,
  });

  // Sign the head with the agent's key, so the record is attributable.
  if (receipts.log.head) {
    try {
      attestation = await signLog({
        head: receipts.log.head,
        did: DID,
        keyId: publishedKey?.key_id ?? null,
        records: receipts.log.records,
        chain: chain.network,
      });
    } catch (error) {
      console.error(`warning: the attestation could not be signed: ${String(error)}`);
    }
  }
  receipts.attestation = attestation;
  receipts.published_key = publishedKey;

  // The contrast run, if there is one, is merged in the same way.
  try {
    const contrastPrevious = JSON.parse(
      await (await import("node:fs/promises")).readFile(
        path.join(REPO_ROOT, "docs", "runs", "contrast", "receipts.json"),
        "utf8",
      ),
    ) as Receipts;
    const contrast = await buildArtifact({
      logPath: path.join(REPO_ROOT, "docs", "runs", "contrast", "decision-log.jsonl"),
      facts,
      menu,
      chain,
      agent: {
        id: contrastPrevious.agent.agent_id,
        address: contrastPrevious.agent.address,
      },
      payer: contrastPrevious.payer_address,
      seller: contrastPrevious.seller,
      task: contrastPrevious.task,
      claim: contrastPrevious.claim,
      fallbackSession: {
        id: contrastPrevious.session.session_id,
        max_amount_per_tx: contrastPrevious.session.max_amount_per_tx,
        max_total_amount: contrastPrevious.session.max_total_amount,
      },
      attestation: contrastPrevious.attestation,
      publishedKey: contrastPrevious.published_key,
    });
    receipts.contrast = contrast.receipts;
  } catch {
    // the contrast run is optional
  }

  await writeFile(
    path.join(REPO_ROOT, "docs", "receipts.json"),
    `${JSON.stringify(receipts, null, 2)}\n`,
  );
  console.log(
    `docs/receipts.json rebuilt from the log: ${receipts.log.records} records, head ${receipts.log.head?.slice(0, 14)}...` +
      `, session ${session.id ?? "unknown"}`,
  );
}

await main();
