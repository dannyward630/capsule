/**
 * The paid routes of the Scout data service.
 *
 * Every route under /v1 costs money and is handled by the x402 payment
 * middleware before it reaches this file. The catalog route is free, so an
 * agent can price its options before it spends anything.
 */
import { Router, type Request, type Response } from "express";
import {
  CATALOG,
  FREE_CATALOG_PATH,
  TOPICS,
  briefing,
  derivedSeries,
  fetchSpot,
  isTopic,
  type Topic,
} from "./catalog.js";

function topicOf(request: Request): Topic | null {
  const raw = String(request.query.topic ?? "").toUpperCase();
  return isTopic(raw) ? raw : null;
}

function badTopic(response: Response) {
  return response.status(400).json({
    error: "unknown_topic",
    topics: TOPICS,
    hint: `Pass ?topic=<${TOPICS.join("|")}>`,
  });
}

export function sellerRouter(): Router {
  const router = Router();

  // Free: what does this service sell, and for how much?
  router.get(FREE_CATALOG_PATH, (_request, response) => {
    response.json({
      service: "Scout",
      description:
        "Decision-grade market statistics in three depths. Every figure states whether it was read live or derived.",
      topics: TOPICS,
      endpoints: CATALOG,
      pricing_note:
        "Prices are in USDC and settled on the network advertised in the x402 challenge.",
    });
  });

  router.get("/v1/snapshot", async (request, response) => {
    const topic = topicOf(request);
    if (!topic) return badTopic(response);
    const spot = await fetchSpot(topic);
    return response.json({
      topic,
      spot_usd: spot.spotUsd,
      change_24h_pct: spot.change24hPct,
      volume_24h_usd: spot.volume24hUsd,
      as_of: spot.asOf,
      source: spot.source,
      depth: "snapshot",
    });
  });

  router.get("/v1/history", async (request, response) => {
    const topic = topicOf(request);
    if (!topic) return badTopic(response);
    const spot = await fetchSpot(topic);
    const series = derivedSeries(topic, spot.spotUsd, 30);
    return response.json({
      topic,
      spot_usd: spot.spotUsd,
      return_7d_pct: series.return_pct,
      return_30d_pct: series.return_pct,
      realized_vol_30d_pct: series.realized_vol_pct,
      max_drawdown_30d_pct: series.max_drawdown_pct,
      vs_ma30_pct: series.vs_ma_pct,
      as_of: spot.asOf,
      spot_source: spot.source,
      series_source: "derived",
      depth: "history",
    });
  });

  router.get("/v1/deep", async (request, response) => {
    const topic = topicOf(request);
    if (!topic) return badTopic(response);
    const spot = await fetchSpot(topic);
    const series = derivedSeries(topic, spot.spotUsd, 90);
    return response.json({
      topic,
      spot_usd: spot.spotUsd,
      return_90d_pct: series.return_pct,
      realized_vol_90d_pct: series.realized_vol_pct,
      max_drawdown_90d_pct: series.max_drawdown_pct,
      vs_ma90_pct: series.vs_ma_pct,
      trading_days_sampled: 90,
      as_of: spot.asOf,
      spot_source: spot.source,
      series_source: "derived",
      depth: "deep",
    });
  });

  router.get("/v1/briefing", async (request, response) => {
    const topic = topicOf(request);
    if (!topic) return badTopic(response);
    const spot = await fetchSpot(topic);
    return response.json({
      topic,
      spot_usd: spot.spotUsd,
      ...briefing(topic, spot),
      as_of: spot.asOf,
      spot_source: spot.source,
      depth: "briefing",
    });
  });

  return router;
}
