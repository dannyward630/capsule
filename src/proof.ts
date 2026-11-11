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
  to: string | null;
  transfers: Array<{ from: string; to: string; value_base_units: string }>;
  matches_receipt: boolean | null;
  note: string;
}

/**
 * Re-reads one settlement from the chain and checks that a USDC transfer of
 * the expected size landed on the seller's address.
 */
export async function verifyStep(
  step: ReceiptStep,
  chain: SettlementChain,
  expectedAmountBaseUnits: string | null,
  sellerPayTo: string,
): Promise<ChainCheck> {
  const base: ChainCheck = {
    tx_hash: step.tx_hash ?? "",
    found: false,
    block_number: null,
    confirmations: null,
    to: null,
    transfers: [],
    matches_receipt: null,
    note: "",
  };
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
    const paid = base.transfers.find(
      (transfer) => transfer.to.toLowerCase() === sellerPayTo.toLowerCase(),
    );
    if (!paid) {
      base.matches_receipt = false;
      base.note += "; no transfer to the seller address in this transaction";
    } else if (expectedAmountBaseUnits === null) {
      base.matches_receipt = null;
      base.note += "; transfer found, no expected amount recorded";
    } else {
      base.matches_receipt = paid.value_base_units === expectedAmountBaseUnits;
      base.note += base.matches_receipt
        ? "; transfer amount matches the receipt"
        : `; transfer amount ${paid.value_base_units} does not match the receipt`;
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
