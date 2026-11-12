import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  DecisionLog,
  GENESIS,
  HASH_ALGORITHM,
  split,
  substitutions,
} from "../src/log.js";

async function scratch() {
  const dir = await mkdtemp(path.join(tmpdir(), "capsule-log-"));
  return path.join(dir, "decisions.jsonl");
}

test("the log starts at genesis and links each record to the last", async () => {
  const log = new DecisionLog({ path: await scratch(), now: () => new Date("2026-11-11T00:00:00Z") });
  const first = await log.append({ kind: "note", message: "start" });
  assert.equal(first.seq, 0);
  assert.equal(first.prev, GENESIS);

  const second = await log.append({ kind: "note", message: "second" });
  assert.equal(second.seq, 1);
  assert.equal(second.prev, first.hash);
  assert.notEqual(second.hash, first.hash);
});

test("the chain verifies when nothing has been touched", async () => {
  const log = new DecisionLog({ path: await scratch() });
  await log.append({ kind: "note", message: "one" });
  await log.append({ kind: "note", message: "two" });
  const result = await log.verifyChain();
  assert.equal(result.ok, true);
  assert.equal(result.checked, 2);
  assert.equal(result.brokenAt, null);
  assert.ok(result.head);
});

test("editing an earlier record breaks the chain and says where", async () => {
  const file = await scratch();
  const log = new DecisionLog({ path: file });
  await log.append({ kind: "note", message: "one" });
  await log.append({ kind: "note", message: "two" });

  const lines = (await readFile(file, "utf8")).split("\n").filter(Boolean);
  const first = JSON.parse(lines[0]!);
  first.decision = { kind: "note", message: "tampered" };
  lines[0] = JSON.stringify(first);
  await writeFile(file, lines.join("\n") + "\n");

  const result = await log.verifyChain();
  assert.equal(result.ok, false);
  assert.equal(result.brokenAt, 0);
  assert.match(result.reason ?? "", /hash does not match/);
});

test("rewriting the records recomputes the chain", async () => {
  const file = await scratch();
  const log = new DecisionLog({ path: file });
  await log.append({ kind: "purchase", service: "s", url: "https://x/y", price_usd: "0.001", asset: "USDC", chain: "eip155:8453", tx_hash: null, reason: "r", fact: null });
  const records = await log.read();
  const purchase = records[0]!.decision;
  if (purchase.kind !== "purchase") throw new Error("expected a purchase record");
  records[0]!.decision = { ...purchase, tx_hash: "0xabc" };
  await log.rewrite(records);
  const after = await log.verifyChain();
  assert.equal(after.ok, true);
  const read = await log.read();
  assert.equal((read[0]!.decision as { tx_hash: string }).tx_hash, "0xabc");
});

test("the log splits into purchases and refusals", async () => {
  const log = new DecisionLog({ path: await scratch() });
  await log.append({ kind: "purchase", service: "s", url: "https://x/a", price_usd: "0.001", asset: "USDC", chain: "eip155:8453", tx_hash: "0x1", reason: "r", fact: "f" });
  await log.append({ kind: "refusal", service: "s", url: "https://x/b", price_usd: "0.05", asset: "USDC", chain: "eip155:8453", error_code: "session_rule_exceeded", message: "too big", reason: "r", fact: "f" });
  const result = split(await log.read());
  assert.equal(result.purchases.length, 1);
  assert.equal(result.refusals.length, 1);
  assert.equal(result.notes.length, 0);
});

test("a refusal knows what the agent bought instead", async () => {
  const log = new DecisionLog({ path: await scratch() });
  await log.append({ kind: "refusal", service: "Trends", url: "https://t/trend", price_usd: "0.05", asset: "USDC", chain: "eip155:8453", error_code: "session_rule_exceeded", message: "over the per-call cap", reason: "wants the trend", fact: "trend" });
  await log.append({ kind: "purchase", service: "CryptoPrice", url: "https://p/price", price_usd: "0.001", asset: "USDC", chain: "eip155:8453", tx_hash: "0x2", reason: "cheaper path", fact: "price" });
  const rows = substitutions(await log.read());
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.error_code, "session_rule_exceeded");
  assert.equal(rows[0]!.wanted_price_usd, "0.05");
  assert.equal(rows[0]!.instead_of?.service, "CryptoPrice");
  assert.equal(rows[0]!.instead_of?.price_usd, "0.001");
});

test("a refusal with nothing after it says so", async () => {
  const log = new DecisionLog({ path: await scratch() });
  await log.append({ kind: "refusal", service: "Trends", url: "https://t/trend", price_usd: "0.05", asset: "USDC", chain: "eip155:8453", error_code: "session_total_exceeded", message: "out of budget", reason: "wants the trend", fact: "trend" });
  const rows = substitutions(await log.read());
  assert.equal(rows[0]!.instead_of, null);
});

test("the hash algorithm is named, and it is keccak", () => {
  assert.equal(HASH_ALGORITHM, "keccak-256");
});
