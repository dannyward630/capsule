import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DecisionLog as PublishedLog } from "../public/log-writer.mjs";
import { DecisionLog } from "../src/log.js";

/**
 * The writer we publish and the implementation we run must agree on the
 * format, or the format page is a lie. This writes a log with the published
 * writer and verifies it with the implementation.
 */
test("a log written by the published writer verifies against our verifier", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "capsule-format-"));
  const file = path.join(dir, "decision-log.jsonl");

  const published = new PublishedLog({ path: file });
  await published.append(
    {
      kind: "purchase",
      service: "Agent402 Tools /api/crypto-price",
      url: "https://agent402.tools/api/crypto-price?coins=ETH&currency=usd",
      price_usd: "0.001",
      asset: "USDC",
      chain: "eip155:8453",
      tx_hash: "0x" + "ab".repeat(32),
      reason: "covers the current price",
      fact: "current ETH price and 24h change",
    },
    {
      id: "agent_session_test",
      max_amount_per_tx: "0.002",
      max_total_amount: "0.0025",
    },
  );
  await published.append(
    {
      kind: "refusal",
      service: "Google Trends (x402Atlas) /trend-over-time",
      url: "https://google-trends.use.x402atlas.com/trend-over-time",
      price_usd: "0.05",
      asset: "USDC",
      chain: "eip155:8453",
      error_code: "session_rule_exceeded",
      message: "payment amount exceeds max_amount_per_tx",
      reason: "covers the trend",
      fact: "search interest and trend over the last month",
    },
    {
      id: "agent_session_test",
      max_amount_per_tx: "0.002",
      max_total_amount: "0.0025",
    },
  );

  // The implementation reads it, and the chain holds.
  const ours = new DecisionLog({ path: file });
  const check = await ours.verifyChain();
  assert.equal(check.ok, true, check.reason ?? "the chain did not hold");
  assert.equal(check.checked, 2);
  assert.ok(check.head?.startsWith("0x"));

  // And the records carry what a third party's reader needs.
  const records = await ours.read();
  assert.equal(records.length, 2);
  assert.equal(records[0]!.decision.kind, "purchase");
  assert.equal(records[1]!.decision.kind, "refusal");
  assert.equal(records[1]!.session?.max_total_amount, "0.0025");
  assert.equal(records[0]!.prev, `0x${"0".repeat(64)}`);

  // One JSON object per line, and nothing else in the file.
  const raw = await readFile(file, "utf8");
  assert.equal(raw.trim().split("\n").length, 2);
  for (const line of raw.trim().split("\n")) {
    assert.doesNotThrow(() => JSON.parse(line));
  }
});

test("the published writer's own verifier catches an edited record", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "capsule-format-"));
  const file = path.join(dir, "decision-log.jsonl");

  const published = new PublishedLog({ path: file });
  await published.append(
    {
      kind: "purchase",
      service: "Scout /v1/snapshot",
      url: "https://example.com/v1/snapshot",
      price_usd: "0.01",
      asset: "USDC",
      chain: "eip155:8453",
      tx_hash: "0x" + "cd".repeat(32),
      reason: "covers a fact",
      fact: "a fact",
    },
  );

  assert.equal((await published.verifyChain()).ok, true);

  // Edit the price after the fact, as an owner who wanted a different number
  // would.
  const { writeFile } = await import("node:fs/promises");
  const raw = await readFile(file, "utf8");
  await writeFile(file, raw.replace('"0.01"', '"0.5"'));

  const broken = await published.verifyChain();
  assert.equal(broken.ok, false);
  assert.equal(broken.brokenAt, 0);
});
