/**
 * The application.
 *
 * Two things live here on purpose. The merchant is a real merchant that
 * settles real USDC. The proof endpoint re-reads the chain rather than
 * repeating what the README says about it.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import express, { type Request, type Response } from "express";
import { paymentMiddleware } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient, x402ResourceServer, type RoutesConfig } from "@x402/core/server";
import { FACILITATOR_URL, chainMoneyParser } from "./kite.js";
import { DEFAULT_CHAIN_ID, chainByName, type SettlementChain } from "./chains.js";
import { CATALOG } from "./catalog.js";
import { sellerRouter } from "./seller.js";
import {
  ChainReader,
  REPO_ROOT,
  chainFor,
  expectedBaseUnits,
  readReceipts,
  verifyStep,
  type Receipts,
} from "./proof.js";

function env(key: string, fallback = ""): string {
  return (process.env[key] ?? "").trim() || fallback;
}

export interface AppConfig {
  chain: SettlementChain;
  payTo: string;
  facilitatorUrl: string;
}

export function readConfig(): AppConfig {
  const chain = chainByName(env("SETTLEMENT_CHAIN", DEFAULT_CHAIN_ID));
  const payTo = env("PAY_TO");
  if (!payTo) {
    throw new Error(
      [
        "PAY_TO is not set, so the merchant has nowhere to send the payments.",
        "",
        "Set it to the address that should receive them:",
        "  cp .env.example .env && edit PAY_TO=0xYourAddress",
        "",
        "The address used by the recorded run is in docs/seller.json.",
      ].join("\n"),
    );
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(payTo)) {
    throw new Error(
      `PAY_TO is not an EVM address: ${payTo}. It must be 0x followed by 40 hex characters.`,
    );
  }
  return { chain, payTo, facilitatorUrl: env("FACILITATOR_URL", FACILITATOR_URL) };
}

/** One paid route per priced endpoint in the catalog. */
export function paidRoutes(config: AppConfig): RoutesConfig {
  const routes: RoutesConfig = {};
  for (const entry of CATALOG) {
    routes[`${entry.method} ${entry.path}`] = {
      accepts: {
        scheme: "exact",
        price: `$${entry.priceUsd}`,
        network: config.chain.network,
        payTo: config.payTo,
        maxTimeoutSeconds: 60,
      },
      description: entry.summary,
      mimeType: "application/json",
      serviceName: "Scout",
      tags: ["market-data", "agent-paid"],
    };
  }
  return routes;
}

/** Cached chain reads, one per chain, shared by every request. */
const readers = new Map<string, ChainReader>();
function readerFor(chain: SettlementChain): ChainReader {
  const existing = readers.get(chain.id);
  if (existing) return existing;
  const reader = new ChainReader(chain);
  readers.set(chain.id, reader);
  return reader;
}

/**
 * Checks every paid step of a record against the chain.
 *
 * One head read for the whole record, and one read per transaction, in
 * parallel. A transaction that cannot be read is "unavailable", which is not
 * the same as "did not match".
 */
export async function checkRecord(
  receipts: Receipts,
): Promise<{
  checks: Array<Awaited<ReturnType<typeof verifyStep>>>;
  allVerified: boolean;
}> {
  const chain = chainFor(receipts.chain.network);
  const reader = readerFor(chain);
  const checks = await Promise.all(
    receipts.steps
      .filter((step) => step.outcome === "paid")
      .map((step) =>
        verifyStep(
          step,
          chain,
          expectedBaseUnits(step.price_usd, chain),
          receipts.payer_address,
          reader,
        ),
      ),
  );
  return {
    checks,
    allVerified:
      checks.length > 0 && checks.every((check) => check.outcome === "confirmed"),
  };
}

export function createApp(config: AppConfig = readConfig()) {
  const app = express();
  app.disable("x-powered-by");
  // Vercel terminates TLS in front of the function and forwards the original
  // scheme in x-forwarded-proto. Without this the x402 challenge would
  // advertise an http:// resource URL, and a payment to it would be refused.
  app.set("trust proxy", true);
  app.use(express.json({ limit: "256kb" }));

  const facilitator = new HTTPFacilitatorClient({ url: config.facilitatorUrl });
  const resourceServer = new x402ResourceServer(facilitator).register(
    config.chain.network,
    new ExactEvmScheme().registerMoneyParser(chainMoneyParser(config.chain)),
  );

  app.get("/healthz", (_request, response) => {
    response.json({
      ok: true,
      service: "Scout",
      network: config.chain.network,
      asset: config.chain.assetSymbol,
      pay_to: config.payTo,
    });
  });

  // Everything under /v1 costs money. The middleware answers 402 until the
  // caller attaches a valid payment, then settles it on chain.
  app.use(paymentMiddleware(paidRoutes(config), resourceServer));

  app.use(sellerRouter());

  // The proof surface. /proof.json re-verifies every recorded settlement
  // against the chain before answering.
  app.get("/proof.json", async (_request: Request, response: Response) => {
    const receipts = await readReceipts();
    if (!receipts) {
      return response.status(200).json({
        status: "no_run_recorded",
        message:
          "No demo run has been recorded yet. The receipts file is written by `npm run demo`.",
      });
    }
    const { checks, allVerified } = await checkRecord(receipts);
    return response.json({
      status: "verified",
      generated_at: receipts.generated_at,
      task: receipts.task,
      claim: receipts.claim,
      session: receipts.session,
      agent: receipts.agent,
      payer_address: receipts.payer_address,
      chain: receipts.chain,
      seller: receipts.seller,
      log: receipts.log,
      counterfactual: receipts.counterfactual,
      attestation: receipts.attestation,
      published_key: receipts.published_key,
      substitutions: receipts.substitutions,
      contrast: receipts.contrast ?? null,
      totals: receipts.totals,
      steps: receipts.steps,
      chain_checks: checks,
      all_payments_verified_on_chain: allVerified,
      note:
        "chain_checks are re-read from the chain at request time; they are not a copy of the receipts.",
    });
  });

  app.get("/proof", (_request, response) => {
    response.redirect("/");
  });

  app.use(express.static(path.join(REPO_ROOT, "public")));

  return app;
}

/**
 * The Express app as Vercel finds it: a default export, so one function
 * handles every route.
 */
const app = createApp();

export default app;
export const config = { maxDuration: 60 };
