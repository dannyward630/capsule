/**
 * The application: the paid data service, and the proof surface a judge can
 * check without an account.
 *
 * Two things live here on purpose. The seller is a real merchant that settles
 * real USDC. The proof page re-reads the chain rather than repeating what our
 * README says about it.
 */
import express, { type Request, type Response } from "express";
import { paymentMiddleware } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient, x402ResourceServer, type RoutesConfig } from "@x402/core/server";
import {
  FACILITATOR_URL,
  chainByName,
  chainMoneyParser,
  type SettlementChain,
} from "./kite.js";
import { CATALOG } from "./catalog.js";
import { sellerRouter } from "./seller.js";
import {
  chainFor,
  dollarsToBaseUnits,
  readReceipts,
  verifyStep,
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
  const chain = chainByName(env("SETTLEMENT_CHAIN", "kite"));
  const payTo = env("PAY_TO");
  if (!payTo) {
    throw new Error(
      "PAY_TO is required: the Kite chain address that receives the payments",
    );
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(payTo)) {
    throw new Error(`PAY_TO is not an EVM address: ${payTo}`);
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

export function createApp(config: AppConfig = readConfig()) {  const app = express();
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
    const chain = chainFor(receipts.chain.network);
    const checks = await Promise.all(
      receipts.steps
        .filter((step) => step.outcome === "paid")
        .map(async (step) => ({
          n: step.n,
          endpoint: step.endpoint,
          price_usd: step.price_usd,
          expected_base_units: dollarsToBaseUnits(
            step.price_usd,
            chain.assetDecimals,
          ),
          ...(await verifyStep(
            step,
            chain,
            dollarsToBaseUnits(step.price_usd, chain.assetDecimals),
          )),
        })),
    );
    const allMatch = checks.every((check) => check.matches_receipt === true);
    return response.json({
      status: "verified",
      generated_at: receipts.generated_at,
      task: receipts.task,
      claim: receipts.claim,
      session: receipts.session,
      agent: receipts.agent,
      chain: receipts.chain,
      seller: receipts.seller,
      log: receipts.log,
      substitutions: receipts.substitutions,
      totals: receipts.totals,
      steps: receipts.steps,
      chain_checks: checks,
      all_payments_verified_on_chain: allMatch,
      note:
        "chain_checks are re-read from the chain at request time; they are not a copy of the receipts.",
    });
  });

  // The judge page is public/index.html. On Vercel the CDN serves public/ and
  // express.static is ignored; locally this mount does the same job.
  app.get("/proof", (_request, response) => {
    response.redirect("/");
  });

  app.use(express.static(new URL("../public", import.meta.url).pathname));

  return app;
}

/**
 * The Express app as Vercel finds it: a default export from src/app.ts, or a
 * port listener. Vercel routes every request to this one function.
 */
const app = createApp();

export default app;
export const config = { maxDuration: 60 };
