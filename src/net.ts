/**
 * Fetching a log somebody else published.
 *
 * We fetch a URL a third party gives us, so this is the one place in the
 * project where the input is hostile. The rules:
 *
 *   - https only, and the host must not be an address literal;
 *   - every resolved address must be a public unicast address, checked after
 *     resolution so a DNS name cannot point at 127.0.0.1 or a metadata
 *     service;
 *   - redirects are followed by hand, and each hop is checked again;
 *   - the body is capped, and the read is timed out.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export interface FetchOptions {
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
}

export class UnsafeUrlError extends Error {}

const DEFAULT_MAX_BYTES = 512 * 1024;
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_REDIRECTS = 3;

/** Hostnames that must never be fetched, whatever they resolve to. */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
]);

/**
 * True when an address is a public unicast address we may connect to.
 *
 * Everything else is refused: loopback, private ranges, link-local, carrier
 * grade NAT, multicast, reserved, and the IPv6 equivalents. The cloud
 * metadata addresses are inside the link-local and private ranges, so they are
 * covered.
 */
export function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const parts = address.split(".").map(Number);
    const a = parts[0] ?? 0;
    const b = parts[1] ?? 0;
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 169 && b === 254) return false; // link-local, and the metadata address
    if (a === 172 && b >= 16 && b <= 31) return false; // private
    if (a === 192 && b === 168) return false; // private
    if (a === 100 && b >= 64 && b <= 127) return false; // carrier grade NAT
    if (a >= 224) return false; // multicast and reserved
    return true;
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    if (lower === "::1" || lower === "::") return false;
    if (lower.startsWith("fe80")) return false; // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return false; // unique local
    if (lower.startsWith("ff")) return false; // multicast
    if (lower.startsWith("::ffff:")) {
      const mapped = lower.slice(7);
      return isPublicAddress(mapped);
    }
    return true;
  }
  return false;
}

/** Rejects a URL that is not one we are willing to fetch. */
export async function assertFetchable(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("that is not a URL");
  }
  if (url.protocol !== "https:") {
    throw new UnsafeUrlError("only https URLs can be fetched");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("a URL with credentials in it cannot be fetched");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(host)) {
    throw new UnsafeUrlError("that host cannot be fetched");
  }
  if (isIP(host)) {
    if (!isPublicAddress(host)) {
      throw new UnsafeUrlError("that address is not a public address");
    }
    return url;
  }
  const addresses = await lookup(host, { all: true }).catch(() => [] as Array<{ address: string }>);
  if (!addresses.length) {
    throw new UnsafeUrlError("that host does not resolve");
  }
  for (const entry of addresses) {
    if (!isPublicAddress(entry.address)) {
      throw new UnsafeUrlError("that host resolves to a non-public address");
    }
  }
  return url;
}

/**
 * Fetches a text document, following redirects by hand so every hop is
 * checked.
 */
export async function fetchText(
  rawUrl: string,
  options: FetchOptions = {},
): Promise<{ url: string; body: string }> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  let current = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const url = await assertFetchable(current);
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: "text/plain, application/json, */*" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new UnsafeUrlError("the server redirected without saying where");
      }
      current = new URL(location, url).toString();
      continue;
    }
    if (!response.ok) {
      throw new Error(`the log host answered HTTP ${response.status}`);
    }
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared && declared > maxBytes) {
      throw new Error("the log is larger than we will read");
    }
    const body = await response.text();
    if (body.length > maxBytes) {
      throw new Error("the log is larger than we will read");
    }
    return { url: current, body };
  }
  throw new UnsafeUrlError("too many redirects");
}
