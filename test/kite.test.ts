import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePrice, toBaseUnits, chainByName, KITE_MAINNET, BASE_MAINNET } from "../src/kite.js";

test("prices are converted to base units with integer maths", () => {
  assert.equal(parsePrice("$0.05", KITE_MAINNET).amount, "50000");
  assert.equal(parsePrice("1.20", KITE_MAINNET).amount, "1200000");
});

test("a price with more precision than the asset allows is rejected", () => {
  assert.throws(() => parsePrice("0.0000001", KITE_MAINNET), /decimals/);
});

test("a zero price is rejected", () => {
  assert.throws(() => parsePrice("0.00", KITE_MAINNET), /below one unit/);
});

test("base units round trip through the decimal string", () => {
  assert.equal(toBaseUnits("0.05", 6), "50000");
  assert.equal(toBaseUnits("1.20", 6), "1200000");
});

test("the EIP-712 domain is pinned to the token contract", () => {
  assert.equal(KITE_MAINNET.eip712Name, "Bridged USDC (Kite AI)");
  assert.equal(KITE_MAINNET.eip712Version, "2");
  assert.equal(BASE_MAINNET.eip712Name, "USD Coin");
});

test("the chain names resolve", () => {
  // Base is the default: the demo wallet is funded there.
  assert.equal(chainByName(undefined).network, "eip155:8453");
  assert.equal(chainByName("base").network, "eip155:8453");
  assert.equal(chainByName("kite").network, "eip155:2366");
  assert.throws(() => chainByName("polygon"), /unknown SETTLEMENT_CHAIN/);
});
