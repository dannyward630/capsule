/**
 * Generates the seller's receiving keypair.
 *
 * The private key never leaves this machine and never enters the repository.
 * The public address is written to docs/seller.json and committed, because it
 * is the address a judge should look for on the explorer.
 */
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { REPO_ROOT } from "../src/paths.js";

const KEY_PATH = path.join(REPO_ROOT, ".secrets", "seller.key");
const PUBLIC_PATH = path.join(REPO_ROOT, "docs", "seller.json");

async function main() {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  await mkdir(path.dirname(KEY_PATH), { recursive: true });
  await writeFile(KEY_PATH, privateKey, { mode: 0o600 });
  await mkdir(path.dirname(PUBLIC_PATH), { recursive: true });
  await writeFile(
    PUBLIC_PATH,
    `${JSON.stringify(
      {
        service: "Scout",
        role: "payment receiver",
        address: account.address,
        network: process.env.SETTLEMENT_CHAIN ?? "kite",
        note: "The private key lives in .secrets/seller.key and is not in this repository. The money this address receives is the service's revenue.",
      },
      null,
      2,
    )}\n`,
  );
  console.log(`seller payTo address: ${account.address}`);
  console.log(`private key written to ${KEY_PATH} (mode 0600, gitignored)`);
  console.log(`public record written to ${PUBLIC_PATH}`);
}

await main();
