/**
 * Builds docs/menu.json — the menu of paid endpoints the agent may buy from.
 *
 * The source of truth is the live Kite service catalog, read with `ksearch`.
 * Only endpoints that settle in the asset and on the chain our session is
 * funded for are eligible, and the price comes from the catalog rather than
 * from us, so the agent is reasoning over real prices.
 */
import { execFile } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { REPO_ROOT } from "../src/proof.js";
import { BASE_MAINNET } from "../src/kite.js";

const exec = promisify(execFile);

/** The services that can answer a market question, and are priced in Base USDC. */
const SERVICES = [
  { id: "84fea4985f760f51dc7cf239", name: "Agent402 Tools" },
  { id: "5d553bd67c457748fb85f7a6", name: "Otto AI" },
  { id: "a3f0a51017902fb794792315", name: "Nansen" },
  { id: "7a9e20ea54a05a688254ed4f", name: "Exa" },
  { id: "ef49f2e41be253237e5eb82f", name: "Google Trends (x402Atlas)" },
];

interface QueryParam {
  name: string;
  type?: string;
  required?: boolean;
  default?: string;
  example?: string;
}

interface Endpoint {
  method: string;
  path: string;
  summary?: string;
  endpoint_url?: string;
  payment_chain?: string;
  payment_asset?: string;
  query_params?: QueryParam[];
  body_params?: Array<{ name: string; type?: string; required?: boolean; default?: string; example?: string }>;
  starting_price?: { amount?: string; asset?: string; unit?: string };
  probe_status?: string;
}

async function readCatalog(
  serviceId: string,
): Promise<{ featured_endpoints?: Endpoint[] }> {
  const { stdout } = await exec("ksearch", ["service", "get", serviceId, "--output", "json"], {
    cwd: REPO_ROOT,
    timeout: 60_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  const parsed = JSON.parse(stdout) as {
    service?: { featured_endpoints?: Endpoint[] };
    featured_endpoints?: Endpoint[];
  };
  return parsed.service ?? { featured_endpoints: parsed.featured_endpoints };
}

/** Applies the catalog's default query parameters so the URL is complete. */
/**
 * The catalog's default parameters are the catalog's, not ours: a trends
 * endpoint defaults to bitcoin. The menu is built for one subject, so the
 * subject-bearing parameters are pointed at it.
 */
const SUBJECT_PARAMS = new Set(["keyword", "symbol", "coin", "coins", "topic", "asset"]);
const SUBJECT = process.env.MENU_SUBJECT ?? "ETH";

function withDefaults(endpoint: Endpoint): string {
  const base = endpoint.endpoint_url ?? "";
  const params = (endpoint.query_params ?? []).filter(
    (param) =>
      SUBJECT_PARAMS.has(param.name) ||
      param.default !== undefined ||
      param.example !== undefined,
  );
  if (params.length === 0) return base;
  const search = params
    .map((param) => {
      const value = SUBJECT_PARAMS.has(param.name)
        ? SUBJECT
        : String(param.default ?? param.example);
      return `${encodeURIComponent(param.name)}=${encodeURIComponent(value)}`;
    })
    .join("&");
  return `${base}?${search}`;
}

async function main() {
  const wanted = process.argv.slice(2);
  const targets = wanted.length
    ? wanted.map((id) => ({ id, name: id }))
    : SERVICES;

  const menu: Array<Record<string, unknown>> = [];
  for (const target of targets) {
    let service: { featured_endpoints?: Endpoint[] };
    try {
      service = await readCatalog(target.id);
    } catch (error) {
      console.log(`skip ${target.id}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    for (const endpoint of service.featured_endpoints ?? []) {
      const asset = endpoint.payment_asset ?? endpoint.starting_price?.asset ?? "";
      const chain = endpoint.payment_chain ?? "";
      const price = endpoint.starting_price?.amount;
      if (asset.toLowerCase() !== BASE_MAINNET.assetAddress.toLowerCase()) continue;
      if (chain && chain !== BASE_MAINNET.network) continue;
      if (!price || price === "unknown") continue;
      const url = withDefaults(endpoint);
      if (!url) continue;
      menu.push({
        id: `${target.id}:${endpoint.method}:${endpoint.path}`,
        service: target.name,
        method: endpoint.method,
        path: endpoint.path,
        url,
        price_usd: price,
        chain,
        asset,
        probe_status: endpoint.probe_status ?? "unknown",
        summary: (endpoint.summary ?? "").slice(0, 320),
        query_params: (endpoint.query_params ?? []).map((param) => param.name),
      });
    }
  }

  menu.sort((a, b) => Number(a.price_usd) - Number(b.price_usd));
  const seen = new Set<string>();
  const unique = menu.filter((entry) => {
    const key = String(entry.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // Short ids. A model copies these into a JSON field, and a long id that
  // looks like a path is a long id it will get subtly wrong.
  unique.forEach((entry, index) => {
    entry.id = `e${String(index + 1).padStart(2, "0")}`;
  });

  await mkdir(path.join(REPO_ROOT, "docs"), { recursive: true });
  await writeFile(
    path.join(REPO_ROOT, "docs", "menu.json"),
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        source: "ksearch service get (the live Kite service catalog)",
        asset: BASE_MAINNET.assetAddress,
        chain: BASE_MAINNET.network,
        endpoints: unique,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`docs/menu.json written: ${unique.length} endpoints`);
  for (const entry of unique) {
    console.log(`  $${entry.price_usd}  ${entry.method}  ${entry.service}  ${entry.path}`);
  }
}

await main();
