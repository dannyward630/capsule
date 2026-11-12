/**
 * The proof surface.
 *
 * A receipt file is written by the demo run and committed. The proof endpoint
 * does not trust it: it re-reads each transaction from the chain and checks
 * the USDC transfer against the receipt, so a judge fetching /proof.json sees
 * the chain's answer, not our claim about the chain.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { KITE_MAINNET, BASE_MAINNET, type SettlementChain } from "./kite.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, "..");
export const RECEIPTS_PATH = path.join(REPO_ROOT, "docs", "receipts.json");

/** keccak256("Transfer(address,address,uint256)") */
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export interface ReceiptStep {
  n: number;
  url: string;
  endpoint: string;
  price_usd: string;
  outcome: "paid" | "refused";
  http_status: number | null;
  error_code: string | null;
  error_message: string | null;
  tx_hash: string | null;
  session_id: string | null;
  spent_total_after: string | null;
  paid_at: string | null;
}

export interface Receipts {
  generated_at: string;
  task: string;
  claim: string;
  session: {
    session_id: string | null;
    task_summary: string | null;
    max_amount_per_tx: string | null;
    max_total_amount: string | null;
    assets: string[] | null;
  };
  agent: { agent_id: string | null; address: string | null };
  chain: {
    network: string;
    chain_id: number;
    asset: string;
    symbol: string;
    explorer: string;
  };
  seller: { name: string; pay_to: string };
  /** The hash chain over the decisions, and its head. */
  log: {
    algorithm: string;
    path: string;
    records: number;
    head: string | null;
    verified: boolean;
  };
  /** For every refusal, what the agent bought instead. */
  substitutions: Array<{
    refusal_seq: number;
    wanted: string;
    wanted_price_usd: string;
    reason: string;
    error_code: string;
    instead_of: {
      seq: number;
      service: string;
      price_usd: string;
      outcome: "bought" | "also refused";
      error_code: string | null;
    } | null;
    instead_reason: string | null;
  }>;
  steps: ReceiptStep[];
  totals: {
    payments: number;
    refusals: number;
    spent_usd: string;
    session_budget_usd: string;
  };
}

export async function readReceipts(): Promise<Receipts | null> {
  try {
    const raw = await readFile(RECEIPTS_PATH, "utf8");
    return JSON.parse(raw) as Receipts;
  } catch {
    return null;
  }
}

export function chainFor(network: string): SettlementChain {
  return network === KITE_MAINNET.network
    ? KITE_MAINNET
    : network === BASE_MAINNET.network
      ? BASE_MAINNET
      : KITE_MAINNET;
}

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`RPC ${method} HTTP ${response.status}`);
  const body = (await response.json()) as { result?: T; error?: { message: string } };
  if (body.error) throw new Error(`RPC ${method}: ${body.error.message}`);
  return body.result as T;
}

export interface ChainCheck {
  tx_hash: string;
  found: boolean;
  block_number: number | null;
  confirmations: number | null;
  merchant: string | null;
  recipient: string | null;
  transfers: Array<{ from: string; to: string; value_base_units: string }>;
  matches_receipt: boolean | null;
  note: string;
}

/**
 * Re-reads one settlement from the chain and checks that a USDC transfer of
 * the expected size moved in it.
 *
 * The recipient is reported rather than compared against a fixed address: the
 * money goes to whichever merchant was paid, and the claim being verified is
 * "this transaction moved exactly this much USDC on this chain".
 */
export async function verifyStep(
  step: ReceiptStep,
  chain: SettlementChain,
  expectedAmountBaseUnits: string | null,
): Promise<ChainCheck> {
  const base: ChainCheck = {
    tx_hash: step.tx_hash ?? "",
    found: false,
    block_number: null,
    confirmations: null,
    merchant: null,
    recipient: null,
    transfers: [],
    matches_receipt: null,
    note: "",
  };
  try {
    base.merchant = new URL(step.url).host;
  } catch {
    base.merchant = null;
  }
  if (!step.tx_hash) {
    base.note = "no transaction hash recorded for this step";
    return base;
  }
  try {
    const receipt = await rpc<{
      blockNumber: string;
      status: string;
      logs: Array<{ topics: string[]; data: string }>;
    } | null>(chain.rpcUrl, "eth_getTransactionReceipt", [step.tx_hash]);
    if (!receipt) {
      base.note = "transaction hash not found on chain";
      return base;
    }
    const block = await rpc<string>(chain.rpcUrl, "eth_blockNumber", []);
    const blockNumber = Number.parseInt(receipt.blockNumber, 16);
    const head = Number.parseInt(block, 16);
    base.found = true;
    base.block_number = blockNumber;
    base.confirmations = Math.max(0, head - blockNumber + 1);
    base.note = receipt.status === "0x1" ? "status success" : "status reverted";

    for (const log of receipt.logs ?? []) {
      if (log.topics?.[0]?.toLowerCase() !== TRANSFER_TOPIC) continue;
      const from = `0x${log.topics[1]?.slice(-40)}`;
      const to = `0x${log.topics[2]?.slice(-40)}`;
      const value = BigInt(log.data).toString();
      base.transfers.push({ from, to, value_base_units: value });
    }
    if (base.transfers.length === 0) {
      base.matches_receipt = false;
      base.note += "; no USDC transfer in this transaction";
      return base;
    }
    const matching = base.transfers.filter(
      (transfer) =>
        expectedAmountBaseUnits === null ||
        transfer.value_base_units === expectedAmountBaseUnits,
    );
    base.recipient = matching[0]?.to ?? base.transfers[0]?.to ?? null;
    if (expectedAmountBaseUnits === null) {
      base.matches_receipt = null;
      base.note += "; a USDC transfer was found, no expected amount recorded";
    } else if (matching.length > 0) {
      base.matches_receipt = true;
      base.note += "; a USDC transfer of exactly the expected amount was found";
    } else {
      base.matches_receipt = false;
      base.note +=
        "; USDC transfers were found but none matched the expected amount " +
        expectedAmountBaseUnits;
    }
    return base;
  } catch (error) {
    base.note = `verification failed: ${error instanceof Error ? error.message : String(error)}`;
    return base;
  }
}

/** Base units of a dollar amount on the settlement chain. */
export function dollarsToBaseUnits(dollars: string, decimals: number): string {
  const [whole = "0", fraction = ""] = dollars.trim().replace(/^\$/, "").split(".");
  return BigInt(whole + fraction.padEnd(decimals, "0")).toString();
}
