/**
 * Verifying a log somebody else published.
 *
 * This is the third-party path: an agent owner writes their agent's spending
 * decisions down, publishes the file, and hands anyone a link. Capsule checks
 * the file and answers what was really bought, what was refused, and why —
 * without the reader trusting the owner's application.
 *
 * The checks are independent on purpose. A log that is not in Capsule's format
 * still has its payments verified against the chain, because the transaction
 * hashes and prices are in the record. A log that is in Capsule's format also
 * has its hash chain verified.
 */
import { fetchText } from "./net.js";
import { ChainReader, expectedBaseUnits, verifyStep, type ChainCheck, type ReceiptStep } from "./proof.js";
import { chainByName, type SettlementChain } from "./chains.js";
import { fromBaseUnits, toBaseUnits } from "./units.js";

export interface PublishedDecision {
  kind?: string;
  service?: string;
  url?: string;
  price_usd?: string;
  asset?: string;
  chain?: string;
  tx_hash?: string | null;
  reason?: string;
  error_code?: string;
  message?: string;
  fact?: string | null;
}

export interface PublishedRecord {
  seq?: number;
  at?: string;
  decision?: PublishedDecision;
  session?: { id?: string | null; max_amount_per_tx?: string | null; max_total_amount?: string | null };
  hash?: string;
  prev?: string;
}

export interface PublishedProof {
  status: "verified" | "partially_verified" | "unverified";
  source: string;
  fetched_from: string;
  records: number;
  /** The chain the record settled on, so a reader can follow the hashes. */
  chain: {
    network: string;
    chain_id: number;
    asset: string;
    symbol: string;
    explorer: string;
  };
  /** "verified", "broken", or "not_a_capsule_log". */
  log_chain: "verified" | "broken" | "not_a_capsule_log";
  log_chain_detail: string | null;
  session: {
    id: string | null;
    max_amount_per_tx: string | null;
    max_total_amount: string | null;
  };
  totals: {
    purchases: number;
    refusals: number;
    spent_usd: string;
    /** What the refusals would have cost together. */
    refused_usd: string;
    /** How many times over the budget that was. */
    budget_multiplier: number | null;
  };
  steps: Array<{
    n: number;
    endpoint: string;
    url: string;
    price_usd: string;
    outcome: "paid" | "refused";
    error_code: string | null;
    tx_hash: string | null;
  }>;
  chain_checks: ChainCheck[];
  notes: string[];
}

/** Does this look like a log written in Capsule's format? */
function isCapsuleLog(records: PublishedRecord[]): boolean {
  return records.every(
    (record) =>
      typeof record.hash === "string" &&
      typeof record.prev === "string" &&
      typeof record.decision === "object" &&
      record.decision !== null,
  );
}

/**
 * Verifies the hash chain of a Capsule-format log.
 *
 * The payload rule has to match the one the log was written with, so this
 * re-derives the hash the same way `src/log.ts` does.
 */
async function verifyLogChain(records: PublishedRecord[]): Promise<{
  ok: boolean;
  detail: string | null;
}> {
  const { keccak256, toHex } = await import("viem");
  let prev = `0x${"0".repeat(64)}`;
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]!;
    const session = record.session;
    const payload = session
      ? { seq: index, at: record.at, decision: record.decision, prev, session }
      : { seq: index, at: record.at, decision: record.decision, prev };
    const hash = keccak256(toHex(JSON.stringify(payload)));
    if (record.prev !== prev) {
      return { ok: false, detail: `record ${index} does not link to the record before it` };
    }
    if (record.hash !== hash) {
      return { ok: false, detail: `record ${index} does not match its own contents` };
    }
    prev = record.hash;
  }
  return { ok: true, detail: null };
}

function parseRecords(body: string): PublishedRecord[] {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as PublishedRecord;
      } catch {
        throw new Error("the log is not one JSON object per line");
      }
    });
}

/**
 * Verifies a published log and returns the proof.
 */
export async function verifyPublishedLog(
  logUrl: string,
  options: { budgetUsd?: number } = {},
): Promise<PublishedProof> {
  const { url: fetchedFrom, body } = await fetchText(logUrl);
  const records = parseRecords(body);
  if (!records.length) {
    throw new Error("the log is empty");
  }

  const notes: string[] = [];
  const firstChain = chainByName(records.find((r) => r.decision?.chain)?.decision?.chain);
  const capsuleLog = isCapsuleLog(records);
  let chainState: PublishedProof["log_chain"] = "not_a_capsule_log";
  let chainDetail: string | null = null;
  if (capsuleLog) {
    const result = await verifyLogChain(records);
    chainState = result.ok ? "verified" : "broken";
    chainDetail = result.detail;
  } else {
    notes.push(
      "This log is not in Capsule's hash-chained format, so its hash chain was not checked. The payments below were still verified against the chain.",
    );
  }

  const sessionRecord = records.find((record) => record.session)?.session;
  const session = {
    id: sessionRecord?.id ?? null,
    max_amount_per_tx: sessionRecord?.max_amount_per_tx ?? null,
    max_total_amount: sessionRecord?.max_total_amount ?? null,
  };

  const steps: PublishedProof["steps"] = [];
  const checks: ChainCheck[] = [];
  const readers = new Map<string, ChainReader>();

  for (let index = 0; index < records.length; index += 1) {
    const decision = records[index]!.decision ?? {};
    const isPurchase = decision.kind === "purchase" || Boolean(decision.tx_hash);
    steps.push({
      n: index,
      endpoint: decision.service ?? "(unnamed)",
      url: decision.url ?? "",
      price_usd: decision.price_usd ?? "0",
      outcome: isPurchase ? "paid" : "refused",
      error_code: decision.error_code ?? null,
      tx_hash: decision.tx_hash ?? null,
    });
    if (!isPurchase || !decision.tx_hash) continue;

    const chain: SettlementChain = chainByName(decision.chain);
    let reader = readers.get(chain.id);
    if (!reader) {
      reader = new ChainReader(chain);
      readers.set(chain.id, reader);
    }
    const step: ReceiptStep = {
      n: index,
      url: decision.url ?? "",
      endpoint: decision.service ?? "",
      price_usd: decision.price_usd ?? "0",
      outcome: "paid",
      http_status: null,
      error_code: null,
      error_message: null,
      tx_hash: decision.tx_hash,
      session_id: session.id,
      spent_total_after: null,
      paid_at: records[index]!.at ?? null,
    };
    checks.push(
      await verifyStep(
        step,
        chain,
        expectedBaseUnits(decision.price_usd ?? "0", chain),
        null,
        reader,
      ),
    );
  }

  const purchases = steps.filter((step) => step.outcome === "paid");
  const refusals = steps.filter((step) => step.outcome === "refused");
  // The decimals come from the chain the record settled on. Base USDC and
  // Kite USDC.e are both six decimals.
  const decimals = chainByName(records.find((r) => r.decision?.chain)?.decision?.chain).assetDecimals;
  const spent = purchases.reduce(
    (total, step) => total + BigInt(toBaseUnits(step.price_usd, decimals)),
    0n,
  );
  const refused = refusals.reduce(
    (total, step) => total + BigInt(toBaseUnits(step.price_usd, decimals)),
    0n,
  );
  const budget = options.budgetUsd ?? Number(session.max_total_amount ?? 0);
  const allConfirmed = checks.length > 0 && checks.every((check) => check.outcome === "confirmed");

  return {
    status: allConfirmed && chainState !== "broken" ? "verified" : "partially_verified",
    source: logUrl,
    fetched_from: fetchedFrom,
    records: records.length,
    chain: {
      network: firstChain.network,
      chain_id: firstChain.chainId,
      asset: firstChain.assetAddress,
      symbol: firstChain.assetSymbol,
      explorer: firstChain.explorerUrl,
    },
    log_chain: chainState,
    log_chain_detail: chainDetail,
    session,
    totals: {
      purchases: purchases.length,
      refusals: refusals.length,
      spent_usd: fromBaseUnits(spent, decimals),
      refused_usd: fromBaseUnits(refused, decimals),
      budget_multiplier:
        budget > 0
          ? Number(
              (
                (Number(refused) / Number(toBaseUnits(String(budget), decimals))).toFixed(2)
              ),
            )
          : null,
    },
    steps,
    chain_checks: checks,
    notes,
  };
}
