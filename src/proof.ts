/**
 * The proof layer.
 *
 * A receipt is what the run recorded. A chain check is what the chain says now.
 * The proof is the two, compared.
 *
 * The chain is read through a small cache: a mined transaction's receipt never
 * changes, so it is read once and kept; the head block is read once per
 * request and shared by every check.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { toBaseUnits } from "./units.js";
import { chainForNetwork, type SettlementChain } from "./chains.js";

const HERE = path.dirname(new URL(import.meta.url).pathname);
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

export interface LogSession {
  id: string | null;
  max_amount_per_tx: string | null;
  max_total_amount: string | null;
}

export interface Receipts {
  /** The same task under a different limit, recorded the same way. */
  contrast?: Receipts;
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
  /** The Passport wallet that paid. The on-chain sender is checked against it. */
  payer_address: string | null;
  chain: {
    network: string;
    chain_id: number;
    asset: string;
    symbol: string;
    explorer: string;
  };
  seller: { name: string; pay_to: string };
  log: {
    algorithm: string;
    path: string;
    records: number;
    head: string | null;
    verified: boolean;
  };
  attestation: {
    domain: string;
    message: string;
    head: string;
    did: string;
    key_id: string | null;
    address: string;
    algorithm: string;
    signature: string;
    signed_at: string;
  } | null;
  published_key: {
    key_id: string;
    pub_key: string;
    address: string;
    active: boolean;
  } | null;
  counterfactual: {
    facts: Array<{
      fact: string;
      covered: boolean;
      blocked_attempt: {
        fact: string | null;
        wanted: string;
        wanted_price_usd: string;
        blocked_by: "budget" | "session cap";
        error_code: string;
      } | null;
    }>;
    attempts: Array<{
      fact: string | null;
      wanted: string;
      wanted_price_usd: string;
      blocked_by: "budget" | "session cap";
      error_code: string;
    }>;
    cost_usd: number;
    budget_multiplier: number | null;
    budget_usd: number;
    unattempted_facts: string[];
  };
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

export async function readReceipts(file = RECEIPTS_PATH): Promise<Receipts | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as Receipts;
  } catch {
    return null;
  }
}

/** The chain a record was settled on, read from the record itself. */
export function chainFor(network: string): SettlementChain {
  return chainForNetwork(network);
}

// ---------------------------------------------------------------- the chain --

interface ChainReceipt {
  blockNumber: string;
  status: string;
  logs: Array<{ address?: string; topics: string[]; data: string }>;
}

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`RPC ${method} HTTP ${response.status}`);
  const body = (await response.json()) as { result?: T; error?: { message: string } };
  if (body.error) throw new Error(`RPC ${method}: ${body.error.message}`);
  return body.result as T;
}

/**
 * Reads the chain, with a cache.
 *
 * A mined transaction's receipt is immutable, so it is fetched once and kept.
 * The head block is fetched once per request and shared by every check, which
 * is what made the old code do two network round trips per paid step.
 */
export class ChainReader {
  private readonly receipts = new Map<string, ChainReceipt | null>();
  private headBlock: number | null = null;

  constructor(private readonly chain: SettlementChain) {}

  async head(): Promise<number> {
    if (this.headBlock !== null) return this.headBlock;
    const block = await rpc<string>(this.chain.rpcUrl, "eth_blockNumber", []);
    this.headBlock = Number.parseInt(block, 16);
    return this.headBlock;
  }

  async receipt(hash: string): Promise<ChainReceipt | null> {
    if (this.receipts.has(hash)) return this.receipts.get(hash) ?? null;
    const receipt = await rpc<ChainReceipt | null>(
      this.chain.rpcUrl,
      "eth_getTransactionReceipt",
      [hash],
    );
    this.receipts.set(hash, receipt);
    return receipt;
  }
}

export type CheckOutcome = "confirmed" | "mismatch" | "unavailable";

export interface ChainCheck {
  tx_hash: string;
  outcome: CheckOutcome;
  found: boolean;
  block_number: number | null;
  confirmations: number | null;
  merchant: string | null;
  recipient: string | null;
  sender: string | null;
  transfers: Array<{ from: string; to: string; value_base_units: string }>;
  note: string;
}

/**
 * Re-reads one settlement and checks it against the receipt.
 *
 * The check is deliberately narrow: a transfer of *this* asset, of *this*
 * amount, paid by *the session's wallet*, to *some* address. The recipient is
 * reported rather than compared, because the money goes to whichever merchant
 * was paid.
 */
export async function verifyStep(
  step: ReceiptStep,
  chain: SettlementChain,
  expectedAmountBaseUnits: string | null,
  expectedSender: string | null = null,
  reader?: ChainReader,
): Promise<ChainCheck> {
  const base: ChainCheck = {
    tx_hash: step.tx_hash ?? "",
    outcome: "unavailable",
    found: false,
    block_number: null,
    confirmations: null,
    merchant: null,
    recipient: null,
    sender: null,
    transfers: [],
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

  const chainReader = reader ?? new ChainReader(chain);
  try {
    const receipt = await chainReader.receipt(step.tx_hash);
    if (!receipt) {
      base.note = "the transaction hash was not found on chain";
      return base;
    }
    const head = await chainReader.head();
    const blockNumber = Number.parseInt(receipt.blockNumber, 16);
    base.found = true;
    base.block_number = blockNumber;
    base.confirmations = Math.max(0, head - blockNumber + 1);
    if (receipt.status !== "0x1") {
      base.outcome = "mismatch";
      base.note = "the transaction reverted";
      return base;
    }

    for (const log of receipt.logs ?? []) {
      if (log.topics?.[0]?.toLowerCase() !== TRANSFER_TOPIC) continue;
      if (log.address?.toLowerCase() !== chain.assetAddress.toLowerCase()) continue;
      base.transfers.push({
        from: `0x${log.topics[1]!.slice(-40)}`,
        to: `0x${log.topics[2]!.slice(-40)}`,
        value_base_units: BigInt(log.data).toString(),
      });
    }
    if (base.transfers.length === 0) {
      base.outcome = "mismatch";
      base.note = `no ${chain.assetSymbol} transfer in this transaction`;
      return base;
    }

    const fromWallet = base.transfers.filter(
      (transfer) =>
        expectedSender === null ||
        transfer.from.toLowerCase() === expectedSender.toLowerCase(),
    );
    if (expectedSender && fromWallet.length === 0) {
      base.outcome = "mismatch";
      base.note = `no transfer was paid by the session's wallet ${expectedSender}`;
      return base;
    }

    const matching = fromWallet.filter(
      (transfer) =>
        expectedAmountBaseUnits === null ||
        transfer.value_base_units === expectedAmountBaseUnits,
    );
    base.recipient = matching[0]?.to ?? fromWallet[0]?.to ?? null;
    base.sender = matching[0]?.from ?? fromWallet[0]?.from ?? null;

    if (matching.length === 0) {
      base.outcome = "mismatch";
      base.note += "; the transfer amount does not match the receipt";
      return base;
    }
    base.outcome = "confirmed";
    base.note = "a transfer of the expected amount was paid by the session's wallet";
    return base;
  } catch (error) {
    base.outcome = "unavailable";
    base.note = `the chain could not be read: ${error instanceof Error ? error.message : String(error)}`;
    return base;
  }
}

/** The base units of a receipt's price on a chain. */
export function expectedBaseUnits(
  priceUsd: string,
  chain: SettlementChain,
): string | null {
  try {
    return toBaseUnits(priceUsd, chain.assetDecimals);
  } catch {
    return null;
  }
}
