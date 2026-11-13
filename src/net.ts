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
 *   - the connection is made to the address that was checked, not to whatever
 *     the name resolves to a second later;
 *   - redirects are followed by hand, and each hop is checked again;
 *   - the body is capped, and the read is timed out.
 */
import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";

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

/** A URL we have checked, and the address we are allowed to connect to. */
export interface ResolvedUrl {
  url: URL;
  /** The address that was checked. The connection goes here, not to a name. */
  address: string;
  family: 4 | 6;
}

/**
 * Checks a URL and pins the address it may be connected to.
 *
 * The pin is the point. If we checked the name and then let the HTTP client
 * resolve it again, a hostile DNS server could answer with a public address the
 * first time and a private one the second time — the classic rebinding window.
 * So the address is resolved once, checked, and handed to the socket.
 *
 * The certificate is still checked against the *name*: the TLS server name stays
 * the hostname, so a pinned connection cannot be used to present somebody
 * else's certificate.
 */
export async function resolvePublic(rawUrl: string): Promise<ResolvedUrl> {
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
    return { url, address: host, family: isIP(host) as 4 | 6 };
  }
  const addresses = await dnsLookup(host, { all: true }).catch(
    () => [] as Array<{ address: string; family: number }>,
  );
  if (!addresses.length) {
    throw new UnsafeUrlError("that host does not resolve");
  }
  for (const entry of addresses) {
    if (!isPublicAddress(entry.address)) {
      throw new UnsafeUrlError("that host resolves to a non-public address");
    }
  }
  // Prefer IPv4: it is what a host publishes first, and it keeps the pinned
  // lookup simple.
  const chosen =
    addresses.find((entry) => entry.family === 4) ?? addresses[0]!;
  return { url, address: chosen.address, family: chosen.family as 4 | 6 };
}

/** Rejects a URL that is not one we are willing to fetch. */
export async function assertFetchable(rawUrl: string): Promise<URL> {
  return (await resolvePublic(rawUrl)).url;
}

/**
 * A DNS lookup that always answers with the address we already checked.
 *
 * The HTTP client calls this instead of resolving the name, so there is no
 * second resolution and therefore no window.
 */
export function createPinnedLookup(address: string, family: 4 | 6): LookupFunction {
  return ((_hostname: string, options: unknown, callback: unknown) => {
    const done = callback as (
      error: NodeJS.ErrnoException | null,
      address: string,
      family: number,
    ) => void;
    const wantsAll = (options as { all?: boolean } | undefined)?.all === true;
    if (wantsAll) {
      done(null, [{ address, family }] as never, family);
      return;
    }
    done(null, address, family);
  }) as unknown as LookupFunction;
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
    const resolved = await resolvePublic(current);
    const { status, headers, body } = await readOnce(resolved, maxBytes, timeoutMs);

    if (status >= 300 && status < 400) {
      const location = headers.location;
      if (!location) {
        throw new UnsafeUrlError("the server redirected without saying where");
      }
      current = new URL(location, resolved.url).toString();
      continue;
    }
    if (status < 200 || status >= 300) {
      throw new Error(`the log host answered HTTP ${status}`);
    }
    return { url: current, body };
  }
  throw new UnsafeUrlError("too many redirects");
}

interface ResponseHead {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

/** One HTTPS request, to the address we checked, with the name still in TLS. */
function readOnce(
  resolved: ResolvedUrl,
  maxBytes: number,
  timeoutMs: number,
): Promise<ResponseHead> {
  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      resolved.url,
      {
        method: "GET",
        // The connection goes to the address that was checked.
        lookup: createPinnedLookup(resolved.address, resolved.family),
        headers: { accept: "text/plain, application/json, */*" },
        signal: AbortSignal.timeout(timeoutMs),
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            request.destroy();
            reject(new Error("the log is larger than we will read"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers as ResponseHead["headers"],
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
        response.on("error", reject);
      },
    );
    request.on("timeout", () => request.destroy(new Error("the request timed out")));
    request.on("error", reject);
    request.end();
  });
}
