/**
 * Chain and asset constants for the two settlement networks we can sell on.
 *
 * Kite mainnet is the chain the Kite Passport settles fastest on and the one the
 * track is named after. Base mainnet is the fallback: it is the network the
 * Passport backend routes to most often, and its USDC needs no custom pricing
 * parser. Both are EIP-3009 `transferWithAuthorization` assets, so the EIP-712
 * domain (name, version) must match the token contract exactly or the
 * facilitator rejects the signature.
 */
import type { AssetAmount, MoneyParser, Network } from "@x402/core/types";

export interface SettlementChain {
  readonly network: Network;
  readonly rpcUrl: string;
  readonly assetAddress: string;
  readonly assetSymbol: string;
  readonly assetDecimals: number;
  readonly eip712Name: string;
  readonly eip712Version: string;
  readonly explorerUrl: string;
}

export const KITE_MAINNET: SettlementChain = {
  network: "eip155:2366",
  rpcUrl: "https://rpc.gokite.ai",
  assetAddress: "0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e",
  assetSymbol: "USDC.e",
  assetDecimals: 6,
  eip712Name: "Bridged USDC (Kite AI)",
  eip712Version: "2",
  explorerUrl: "https://kitescan.ai",
};

export const BASE_MAINNET: SettlementChain = {
  network: "eip155:8453",
  rpcUrl: "https://mainnet.base.org",
  assetAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  assetSymbol: "USDC",
  assetDecimals: 6,
  eip712Name: "USD Coin",
  eip712Version: "2",
  explorerUrl: "https://basescan.org",
};

export const FACILITATOR_URL = "https://facilitator.pieverse.io/v2";

export function chainByName(name: string | undefined): SettlementChain {
  switch ((name ?? "kite").trim().toLowerCase()) {
    case "":
    case "kite":
      return KITE_MAINNET;
    case "base":
      return BASE_MAINNET;
    default:
      throw new Error(
        `unknown SETTLEMENT_CHAIN "${name}" (want kite or base)`,
      );
  }
}

/**
 * Prices are written as dollars ("0.002") and converted to the asset's base
 * units with integer maths, so no float ever touches a settlement amount.
 */
export function parsePrice(
  price: string,
  chain: SettlementChain,
): AssetAmount {
  const text = price.trim().replace(/^\$/, "");
  if (!/^\d+(?:\.\d+)?$/.test(text)) {
    throw new Error(`price must be a positive decimal, got "${price}"`);
  }
  const [whole = "0", fraction = ""] = text.split(".");
  if (fraction.length > chain.assetDecimals) {
    throw new Error(
      `price ${text} has more than ${chain.assetDecimals} decimals (${chain.assetSymbol})`,
    );
  }
  const units = BigInt(whole + fraction.padEnd(chain.assetDecimals, "0"));
  if (units <= 0n) throw new Error(`price ${price} is below one unit of ${chain.assetSymbol}`);
  return {
    asset: chain.assetAddress,
    amount: units.toString(),
    extra: { name: chain.eip712Name, version: chain.eip712Version },
  };
}

/**
 * A money parser the x402 resource server asks to price a route. It only
 * answers for our own chain and pins the EIP-712 domain the facilitator
 * expects, which the SDK cannot know for Kite's bridged USDC.
 */
export function chainMoneyParser(
  chain: SettlementChain,
): MoneyParser {
  return async (
    amount: string | number,
    network: Network,
  ): Promise<AssetAmount | null> => {
    if (network !== chain.network) return null;
    const text =
      typeof amount === "number"
        ? amount.toFixed(chain.assetDecimals)
        : amount.trim().replace(/^\$/, "");
    if (!/^\d+(\.\d+)?$/.test(text) || Number(text) <= 0) {
      throw new Error(`price must be a positive decimal, got ${amount}`);
    }
    return parsePrice(text, chain);
  };
}

/** Base units of `price` dollars, as a string, without touching a float. */
export function toBaseUnits(price: string, decimals: number): string {
  const [whole = "0", fraction = ""] = price.trim().replace(/^\$/, "").split(".");
  return BigInt(whole + fraction.padEnd(decimals, "0")).toString();
}
