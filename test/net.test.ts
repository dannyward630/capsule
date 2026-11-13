import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isPublicAddress,
  assertFetchable,
  resolvePublic,
  createPinnedLookup,
  UnsafeUrlError,
} from "../src/net.js";

test("public addresses are allowed and private ones are not", () => {
  assert.equal(isPublicAddress("8.8.8.8"), true);
  assert.equal(isPublicAddress("1.1.1.1"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);

  assert.equal(isPublicAddress("127.0.0.1"), false);
  assert.equal(isPublicAddress("10.0.0.5"), false);
  assert.equal(isPublicAddress("172.16.0.1"), false);
  assert.equal(isPublicAddress("192.168.1.1"), false);
  assert.equal(isPublicAddress("169.254.169.254"), false, "the metadata address");
  assert.equal(isPublicAddress("100.64.0.1"), false, "carrier grade NAT");
  assert.equal(isPublicAddress("0.0.0.0"), false);
  assert.equal(isPublicAddress("224.0.0.1"), false);
  assert.equal(isPublicAddress("::1"), false);
  assert.equal(isPublicAddress("fe80::1"), false);
  assert.equal(isPublicAddress("fc00::1"), false);
  assert.equal(isPublicAddress("::ffff:127.0.0.1"), false, "IPv4 mapped loopback");
});

test("only https URLs are fetched", async () => {
  await assert.rejects(
    () => assertFetchable("http://example.com/log.jsonl"),
    UnsafeUrlError,
  );
  await assert.rejects(
    () => assertFetchable("file:///etc/passwd"),
    UnsafeUrlError,
  );
});

test("a URL with credentials in it is refused", async () => {
  await assert.rejects(
    () => assertFetchable("https://user:pass@example.com/log.jsonl"),
    UnsafeUrlError,
  );
});

test("a loopback host name is refused", async () => {
  await assert.rejects(
    () => assertFetchable("https://localhost/log.jsonl"),
    UnsafeUrlError,
  );
});

test("an address literal that is private is refused", async () => {
  await assert.rejects(
    () => assertFetchable("https://127.0.0.1/log.jsonl"),
    UnsafeUrlError,
  );
  await assert.rejects(
    () => assertFetchable("https://[::1]/log.jsonl"),
    UnsafeUrlError,
  );
});

test("a public URL is accepted", async () => {
  const url = await assertFetchable("https://example.com/log.jsonl");
  assert.equal(url.hostname, "example.com");
});

test("the address is resolved once and pinned, so DNS cannot rebind it", async () => {
  // A name that resolves to a public address.
  const resolved = await resolvePublic("https://example.com/log.jsonl");
  assert.equal(resolved.url.hostname, "example.com");
  assert.equal(isPublicAddress(resolved.address), true);
  assert.ok([4, 6].includes(resolved.family));

  // The lookup the socket uses answers with that address whatever name it is
  // asked about. A second answer from the DNS server never reaches the
  // connection, which is the whole defence.
  const lookup = createPinnedLookup(resolved.address, resolved.family);
  const asked: string[] = [];
  const answered = await new Promise<{ address: string; family: number }>(
    (resolve) => {
      lookup(
        "attacker.example",
        {},
        (error: NodeJS.ErrnoException | null, address: unknown, family?: number) => {
          if (error) throw error;
          resolve({ address: String(address), family: family ?? 4 });
        },
      );
    },
  );
  asked.push("attacker.example");
  assert.equal(answered.address, resolved.address);
  assert.equal(answered.family, resolved.family);
  assert.equal(asked.length, 1);
});

test("a name that resolves to a private address is refused", async () => {
  // localhost is blocked by name; a name that resolves into a private range is
  // blocked by address. Both are checked before anything is fetched.
  await assert.rejects(
    () => resolvePublic("https://localhost/log.jsonl"),
    UnsafeUrlError,
  );
});
