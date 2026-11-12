/**
 * The chain registry.
 *
 * Every chain fact lives here once: the network, the asset, its decimals, the
 * EIP-712 domain the facilitator verifies against, the explorer, and the RPC.
 * Nothing else in the codebase hard-codes a chain id or an asset address.
 */
export interface SettlementChain {
  readonly id: string;
  readonly network: `eip155:${number}`;
  readonly chainId: number;
  readonly rpcUrl: string;
  readonly assetAddress: `0x${string}`;
  readonly assetSymbol: string;
  readonly assetDecimals: number;
  /** The EIP-712 domain, which must match the token contract exactly. */
  readonly eip712Name: string;
  readonly eip712Version: string;
  readonly explorerUrl: string;
  /** True when the Passport settles this chain natively. */
  readonly passportNative: boolean;
}

export const BASE_MAINNET: SettlementChain = {
  id: "base",
  network: "eip155:8453",
  chainId: 8453,
  rpcUrl: "https://mainnet.base.org",
  assetAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  assetSymbol: "USDC",
  assetDecimals: 6,
  eip712Name: "USD Coin",
  eip712Version: "2",
  explorerUrl: "https://basescan.org",
  passportNative: true,
};

export const KITE_MAINNET: SettlementChain = {
  id: "kite",
  network: "eip155:2366",
  chainId: 2366,
  rpcUrl: "https://rpc.gokite.ai",
  assetAddress: "0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e",
  assetSymbol: "USDC.e",
  assetDecimals: 6,
  eip712Name: "Bridged USDC (Kite AI)",
  eip712Version: "2",
  explorerUrl: "https://kitescan.ai",
  passportNative: true,
};

export const KITE_TESTNET: SettlementChain = {
  id: "kite-testnet",
  network: "eip155:2368",
  chainId: 2368,
  rpcUrl: "https://rpc-testnet.gokite.ai",
  assetAddress: "0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A",
  assetSymbol: "pieUSD",
  assetDecimals: 18,
  eip712Name: "pieUSD",
  eip712Version: "1",
  explorerUrl: "https://kitescan.ai",
  passportNative: false,
};

export const CHAINS: Record<string, SettlementChain> = {
  base: BASE_MAINNET,
  kite: KITE_MAINNET,
  "kite-testnet": KITE_TESTNET,
};

export const DEFAULT_CHAIN_ID = "base";

/** Resolves a chain by name, network or numeric id. */
export function chainByName(name: string | undefined): SettlementChain {
  const key = (name ?? DEFAULT_CHAIN_ID).trim().toLowerCase();
  if (CHAINS[key]) return CHAINS[key]!;
  const numeric = key.startsWith("eip155:") ? key.slice(6) : key;
  const found = Object.values(CHAINS).find(
    (chain) => chain.id === numeric || String(chain.chainId) === numeric || chain.network === key,
  );
  if (!found) {
    throw new Error(
      `unknown chain "${name}". Known: ${Object.keys(CHAINS).join(", ")}`,
    );
  }
  return found;
}

/** The chain a record was settled on, read from the record itself. */
export function chainForNetwork(network: string): SettlementChain {
  return chainByName(network);
}
