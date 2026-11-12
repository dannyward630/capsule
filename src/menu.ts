/**
 * The menu of paid endpoints the agent may buy from.
 *
 * It is the live Kite service catalog, filtered to the chain and asset our
 * session is funded for. The prices come from the catalog, not from us, so the
 * model is reasoning over real costs.
 *
 * The filtering is the product's thesis, not a convenience. The code decides
 * what the agent can afford in total and hands the model only that shortlist,
 * so the model can never plan past the budget. The per-transaction ceiling is
 * deliberately *not* applied here: that limit belongs to the Passport, and the
 * agent is meant to be able to try for the better answer and be refused by the
 * thing that actually enforces it.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { REPO_ROOT } from "./proof.js";

export interface MenuEntry {
  id: string;
  service: string;
  method: string;
  path: string;
  url: string;
  price_usd: string;
  chain: string;
  asset: string;
  probe_status: string;
  summary: string;
  query_params: string[];
  /** The fields the endpoint returns, from the catalog. */
  returns: string[];
  /** The catalog's own tags for the endpoint. */
  tags: string[];
}

export interface Menu {
  generated_at: string;
  source: string;
  asset: string;
  chain: string;
  endpoints: MenuEntry[];
}

export const MENU_PATH = path.join(REPO_ROOT, "docs", "menu.json");

export async function loadMenu(): Promise<Menu> {
  const raw = await readFile(MENU_PATH, "utf8");
  const menu = JSON.parse(raw) as Menu;
  if (!menu.endpoints || menu.endpoints.length === 0) {
    throw new Error("the menu is empty; run `npm run menu` first");
  }
  return menu;
}

/**
 * What the agent can afford right now, in total.
 *
 * This is the code-side budget decision. The model is never shown an endpoint
 * whose price is above what is left, so it cannot spend more than the session
 * allows even if it tries.
 */
export function affordable(menu: Menu, remainingUsd: number): MenuEntry[] {
  return menu.endpoints.filter(
    (entry) => Number(entry.price_usd) <= remainingUsd + 1e-9,
  );
}

/**
 * The endpoints that the remaining budget puts out of reach.
 *
 * This is what the limit costs, in the catalog's own prices, and it is the
 * counterfactual the owner never gets to see.
 */
export function outOfReach(menu: Menu, remainingUsd: number): MenuEntry[] {
  return menu.endpoints
    .filter((entry) => Number(entry.price_usd) > remainingUsd + 1e-9)
    .sort((a, b) => Number(a.price_usd) - Number(b.price_usd));
}

/**
 * A loose match between a fact the answer needs and the fields an endpoint
 * returns, so the record can say which catalog endpoint would have covered it.
 */
export function coversFact(entry: MenuEntry, fact: string): boolean {
  const words = fact
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word));
  if (!words.length) return false;
  const haystack = `${entry.summary ?? ""} ${(entry.returns ?? []).join(" ")} ${entry.path ?? ""} ${(entry.tags ?? []).join(" ")}`.toLowerCase();
  const hits = words.filter((word) => haystack.includes(word)).length;
  return hits >= 2;
}

const STOP_WORDS = new Set([
  "and",
  "the",
  "for",
  "with",
  "that",
  "this",
  "from",
  "were",
  "what",
  "price",
  "current",
  "over",
  "last",
  "month",
  "risk",
  "main",
  "fact",
  "facts",
  "covered",
]);

export interface CounterfactualFact {
  fact: string;
  covered: boolean;
  /** The cheapest endpoint in the catalog that could have covered it. */
  cheapest: { id: string; service: string; path: string; price_usd: string; url: string } | null;
  /** What stopped it. */
  blocked_by: "budget" | "session cap" | null;
}

export interface Counterfactual {
  /** The facts the answer needed. */
  facts: CounterfactualFact[];
  /** What the remaining budget could not reach. */
  unreachable: Array<{ id: string; service: string; path: string; price_usd: string }>;
  /** The cheapest endpoint in the whole catalog, and what it costs against the budget. */
  cheapest_unreachable: { id: string; service: string; path: string; price_usd: string } | null;
  /** How many times the remaining budget was smaller than the evidence it wanted. */
  budget_multiplier: number | null;
}
