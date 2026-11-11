/**
 * The agent: a reasoning layer that buys data it cannot afford not to buy.
 *
 * The loop is deliberately small. The model proposes one purchase at a time.
 * The Passport decides whether that purchase is allowed. A refusal is fed
 * back to the model as state, and the model chooses what to do next. Nothing in
 * this file can raise a limit, because the limit does not live here.
 */
import { randomUUID } from "node:crypto";
import { Kpass, isCapRefusal, type KpassResult } from "./kpass.js";
import { ServClient, type ServChoice } from "./serv.js";
import type { ReceiptStep } from "./proof.js";

export interface AgentOptions {
  task: string;
  sellerBaseUrl: string;
  sessionId?: string | null;
  maxSteps?: number;
}

export interface AgentRun {
  steps: ReceiptStep[];
  evidence: Array<{ endpoint: string; data: unknown }>;
  refusals: Array<{ endpoint: string; error_code: string; message: string }>;
  answer: string;
  servCalls: unknown[];
  session: {
    session_id: string | null;
    max_amount_per_tx: string | null;
    max_total_amount: string | null;
    spent_total: string | null;
    assets: string[] | null;
  };
}

interface CatalogEntry {
  path: string;
  method: string;
  price_usd: string;
  summary: string;
  returns: string[];
}

export class Agent {
  private readonly options: AgentOptions;
  private readonly kpass: Kpass;
  private readonly serv: ServClient;
  private catalog: CatalogEntry[] = [];

  constructor(options: AgentOptions, kpass: Kpass, serv: ServClient) {
    this.options = options;
    this.kpass = kpass;
    this.serv = serv;
  }

  /** The free catalog. An agent prices its options before it spends anything. */
  async loadCatalog(): Promise<CatalogEntry[]> {
    const response = await fetch(
      `${this.options.sellerBaseUrl.replace(/\/$/, "")}/catalog`,
    );
    if (!response.ok) {
      throw new Error(`catalog HTTP ${response.status}`);
    }
    const body = (await response.json()) as { endpoints?: CatalogEntry[] };
    this.catalog = body.endpoints ?? [];
    return this.catalog;
  }

  async run(): Promise<AgentRun> {
    const maxSteps = this.options.maxSteps ?? 8;
    const steps: ReceiptStep[] = [];
    const evidence: Array<{ endpoint: string; data: unknown }> = [];
    const refusals: Array<{ endpoint: string; error_code: string; message: string }> = [];
    const bought = new Set<string>();
    let session = {
      session_id: null as string | null,
      max_amount_per_tx: null as string | null,
      max_total_amount: null as string | null,
      spent_total: null as string | null,
      assets: null as string[] | null,
    };

    for (let index = 0; index < maxSteps; index += 1) {
      const decision = await this.serv.decide({
        purpose: `decision ${index + 1}`,
        task: this.options.task,
        catalog: this.catalog.map((entry) => ({
          path: entry.path,
          price_usd: entry.price_usd,
          summary: entry.summary,
          returns: entry.returns,
        })),
        state: {
          step: index + 1,
          spent_total: session.spent_total,
          max_total_amount: session.max_total_amount,
          max_amount_per_tx: session.max_amount_per_tx,
          already_bought: [...bought],
          refusals,
          evidence_held: evidence.map((item) => item.endpoint),
        },
      });

      const choice: ServChoice = decision.choice;
      if (choice.action !== "buy" || !choice.endpoint) {
        break;
      }
      const entry = this.catalog.find((item) => item.path === choice.endpoint);
      if (!entry) {
        refusals.push({
          endpoint: choice.endpoint,
          error_code: "unknown_endpoint",
          message: `the model asked for ${choice.endpoint}, which is not in the catalog`,
        });
        continue;
      }
      const topic = choice.topic ?? "ETH";
      const key = `${entry.path}?topic=${topic}`;
      if (bought.has(key)) {
        refusals.push({
          endpoint: key,
          error_code: "already_bought",
          message: "the model asked for a resource it already holds",
        });
        continue;
      }

      const url = `${this.options.sellerBaseUrl.replace(/\/$/, "")}${entry.path}?topic=${encodeURIComponent(topic)}`;
      const idempotencyKey = randomUUID();
      const result = await this.kpass.pay(url, idempotencyKey, entry.method);
      const step = toStep(index + 1, url, entry, result);
      steps.push(step);

      if (result.ok) {
        bought.add(key);
        const body = result.x402?.parsed_response_body;
        evidence.push({ endpoint: key, data: body ?? result.x402?.response_body ?? null });
        session = {
          session_id: result.session_id ?? session.session_id,
          max_amount_per_tx:
            result.delegation?.payment_policy?.max_amount_per_tx ?? session.max_amount_per_tx,
          max_total_amount:
            result.delegation?.payment_policy?.max_total_amount ?? session.max_total_amount,
          spent_total: result.usage?.spent_total ?? session.spent_total,
          assets: result.delegation?.payment_policy?.assets ?? session.assets,
        };
        continue;
      }

      if (isCapRefusal(result)) {
        refusals.push({
          endpoint: key,
          error_code: result.error_code ?? "unknown",
          message: result.error ?? result.hint ?? "the spending session refused this purchase",
        });
        session = {
          session_id: session.session_id,
          max_amount_per_tx:
            result.delegation?.payment_policy?.max_amount_per_tx ?? session.max_amount_per_tx,
          max_total_amount:
            result.delegation?.payment_policy?.max_total_amount ?? session.max_total_amount,
          spent_total: result.usage?.spent_total ?? session.spent_total,
          assets: result.delegation?.payment_policy?.assets ?? session.assets,
        };
        continue;
      }

      // A failure that is not a cap refusal is a real error. Stop and report it.
      refusals.push({
        endpoint: key,
        error_code: result.error_code ?? `exit_${result.exit_code}`,
        message: result.error ?? "unknown failure",
      });
      break;
    }

    const final = await this.serv.answer({
      task: this.options.task,
      evidence,
      refusals,
      session: {
        max_amount_per_tx: session.max_amount_per_tx,
        max_total_amount: session.max_total_amount,
        spent_total: session.spent_total,
      },
    });

    return {
      steps,
      evidence,
      refusals,
      answer: final.text,
      servCalls: this.serv.calls,
      session,
    };
  }
}

function toStep(
  n: number,
  url: string,
  entry: CatalogEntry,
  result: KpassResult,
): ReceiptStep {
  const endpoint = url.replace(/^https?:\/\/[^/]+/, "");
  if (result.ok) {
    return {
      n,
      url,
      endpoint,
      price_usd: entry.price_usd,
      outcome: "paid",
      http_status: result.x402?.status_code ?? null,
      error_code: null,
      error_message: null,
      tx_hash: findTransactionHash(result),
      session_id: result.session_id ?? null,
      spent_total_after: result.usage?.spent_total ?? null,
      paid_at: new Date().toISOString(),
    };
  }
  return {
    n,
    url,
    endpoint,
    price_usd: entry.price_usd,
    outcome: "refused",
    http_status: null,
    error_code: result.error_code,
    error_message: result.error ?? result.hint ?? null,
    tx_hash: null,
    session_id: null,
    spent_total_after: result.usage?.spent_total ?? null,
    paid_at: null,
  };
}

/** The settlement reference, wherever the CLI put it. */
function findTransactionHash(result: Extract<KpassResult, { ok: true }>): string | null {
  const raw = result.raw as Record<string, unknown> | null;
  const payment = raw?.payment as Record<string, unknown> | undefined;
  const response = payment?.payment_response as Record<string, unknown> | undefined;
  const reference = response?.reference;
  if (typeof reference === "string" && reference.length > 0) return reference;
  const transaction = response?.transaction as Record<string, unknown> | undefined;
  const hash = transaction?.hash;
  return typeof hash === "string" && hash.length > 0 ? hash : null;
}
