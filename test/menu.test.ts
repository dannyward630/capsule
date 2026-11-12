import { test } from "node:test";
import assert from "node:assert/strict";
import { bestEndpointForFact, matchScore, relevantTo, type Menu } from "../src/menu.js";
import { computeCounterfactual } from "../src/counterfactual.js";
import type { LogRecord } from "../src/log.js";

const MENU: Menu = {
  generated_at: "2026-11-12T00:00:00.000Z",
  source: "test",
  asset: "0xasset",
  chain: "eip155:8453",
  endpoints: [
    {
      id: "e01",
      service: "Agent402 Tools",
      method: "GET",
      path: "/api/crypto-price",
      url: "https://agent402.tools/api/crypto-price?coins=ETH",
      price_usd: "0.001",
      chain: "eip155:8453",
      asset: "0xasset",
      probe_status: "unknown",
      summary: "Live spot price, 24h change and 24h volume for one or many coins",
      query_params: ["coins"],
      returns: ["spot_usd", "change_24h_pct", "volume_24h_usd"],
      tags: ["api", "crypto-price"],
    },
    {
      id: "e02",
      service: "Google Trends",
      method: "GET",
      path: "/trend-over-time",
      url: "https://google-trends.use.x402atlas.com/trend-over-time?keyword=ETH",
      price_usd: "0.05",
      chain: "eip155:8453",
      asset: "0xasset",
      probe_status: "unknown",
      summary:
        "Search interest over time for a keyword, as a dated 0-100 series with country targeting",
      query_params: ["keyword"],
      returns: ["trend_points", "search_interest"],
      tags: ["trends", "search-interest"],
    },
  ],
};

test("the code shortlists by relevance, never by affordability", () => {
  // The trend fact is served by the $0.05 endpoint, and it is in the
  // shortlist even though the budget could never cover it. Deciding what the
  // agent may afford is the Passport's job.
  const trend = relevantTo(MENU, "search interest and trend over the last month");
  assert.equal(trend[0]!.id, "e02");
  assert.equal(trend[0]!.price_usd, "0.05");
  const price = relevantTo(MENU, "current ETH price and 24h change");
  assert.equal(price[0]!.id, "e01");
  // A fact no endpoint claims still gets a menu, so the model can try for
  // partial coverage rather than being told there is nothing.
  const fallback = relevantTo(MENU, "a fact no endpoint covers");
  assert.equal(fallback.length, 2);
  assert.equal(fallback[0]!.id, "e01");
});

test("the matcher finds the endpoint that covers a fact", () => {
  const best = bestEndpointForFact(MENU, "current ETH price and 24h change");
  assert.equal(best?.id, "e01");
  const trend = bestEndpointForFact(MENU, "search interest and trend over the last month");
  assert.equal(trend?.id, "e02");
  assert.ok(matchScore(MENU.endpoints[1]!, "search interest and trend over the last month") >= 2);
});

test("the cost of the limit is the sum of the refused attempts", () => {
  const records: LogRecord[] = [
    {
      seq: 0,
      at: "2026-11-12T00:00:00.000Z",
      hash: "0x1",
      prev: "0x0",
      decision: {
        kind: "purchase",
        service: "Agent402 Tools /api/crypto-price",
        url: "https://agent402.tools/api/crypto-price",
        price_usd: "0.001",
        asset: "USDC",
        chain: "eip155:8453",
        tx_hash: "0xabc",
        reason: "price",
        fact: "current ETH price and 24h change",
      },
    },
    {
      seq: 1,
      at: "2026-11-12T00:00:01.000Z",
      hash: "0x2",
      prev: "0x1",
      decision: {
        kind: "refusal",
        service: "Google Trends /trend-over-time",
        url: "https://google-trends.use.x402atlas.com/trend-over-time",
        price_usd: "0.05",
        asset: "USDC",
        chain: "eip155:8453",
        error_code: "session_rule_exceeded",
        message: "payment amount exceeds max_amount_per_tx",
        reason: "trend",
        fact: "search interest and trend over the last month",
      },
    },
  ];
  const result = computeCounterfactual({
    records,
    facts: [
      "current ETH price and 24h change",
      "search interest and trend over the last month",
      "main risk factors",
    ],
    menu: MENU,
    budgetUsd: 0.0025,
  });
  assert.equal(result.cost_usd, 0.05);
  assert.equal(result.budget_usd, 0.0025);
  assert.equal(result.budget_multiplier, 20);
  assert.equal(result.facts[0]!.covered, true);
  assert.equal(result.facts[1]!.covered, false);
  assert.equal(result.facts[1]!.blocked_attempt?.blocked_by, "session cap");
  assert.equal(result.facts[2]!.blocked_attempt, null);
  assert.deepEqual(result.unattempted_facts, ["main risk factors"]);
});

test("a fact nobody tried is priced from the catalog", () => {
  const result = computeCounterfactual({
    records: [],
    facts: ["search interest and trend over the last month"],
    menu: MENU,
    budgetUsd: 0.0025,
  });
  assert.equal(result.facts[0]!.blocked_attempt?.wanted_price_usd, "0.05");
  assert.equal(result.facts[0]!.blocked_attempt?.blocked_by, "budget");
});
