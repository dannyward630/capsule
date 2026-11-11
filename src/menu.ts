/**
 * The menu of paid endpoints the agent may buy from.
 *
 * It is the live Kite service catalog, filtered to the chain and asset our
 * session is funded for. The prices come from the catalog, so the model is
 * reasoning over the real cost of each option.
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

/** The entries the agent is allowed to consider, cheapest first. */
export function affordable(menu: Menu, maxPriceUsd: number): MenuEntry[] {
  return menu.endpoints.filter(
    (entry) => Number(entry.price_usd) <= maxPriceUsd + 1e-9,
  );
}
