/**
 * Sends one decision request to SERV and prints the raw response.
 *
 * Used to diagnose what the reasoning layer actually returns, including any
 * redaction or filtering it applies.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { REPO_ROOT } from "../src/proof.js";
import { SYSTEM_PROMPT } from "../src/agent.js";

const menu = JSON.parse(
  await readFile(path.join(REPO_ROOT, "docs", "menu.json"), "utf8"),
) as { endpoints: Array<Record<string, unknown>> };

const system = process.env.PROBE_SYSTEM ?? SYSTEM_PROMPT;

const user = JSON.stringify({
  task: "Give me a cautious assessment of ETH: has it trended up this month, how volatile is it, and what are the main risks right now?",
  facts_still_missing: (process.env.PROBE_FACTS ?? "current ETH price and 24h change;sentiment and recent headlines;search interest and trend over the last month").split(";"),
  budget_remaining_usd: process.env.PRICE_AS_DOLLARS ? "$0.003" : 0.003,
  budget_total_usd: process.env.PRICE_AS_DOLLARS ? "$0.003" : 0.003,
  already_bought: [],
  refusals: [],
  evidence_held: [],
  menu: menu.endpoints.map((entry) => ({
    id: entry.id,
    service: entry.service,
    method: entry.method,
    path: entry.path,
    price_usd: process.env.PRICE_AS_DOLLARS ? `$${entry.price_usd}` : entry.price_usd,
    summary: entry.summary,
  })),
});

const body = {
  model: process.env.SERV_MODEL ?? "gpt-5.4-mini",
  messages: [
    { role: "system", content: system },
    { role: "user", content: user },
  ],
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "purchase_decision",
      strict: true,
      schema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["buy", "answer"] },
          id: { type: ["string", "null"] },
          reason: { type: "string" },
        },
        required: ["action", "id", "reason"],
        additionalProperties: false,
      },
    },
  },
};

const response = await fetch(
  `${process.env.SERV_BASE_URL ?? "https://inference-api.openserv.ai/v1"}/chat/completions`,
  {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.SERV_API_KEY ?? ""}`,
    },
    body: JSON.stringify(body),
  },
);
console.log("status:", response.status);
const text = await response.text();
console.log("raw:", text.slice(0, 3000));
