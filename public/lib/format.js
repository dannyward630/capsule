/**
 * Formatting.
 *
 * Pure functions. Nothing here knows about the DOM or the network, so the
 * wording of a record can be checked without rendering it.
 */

/** A dollar amount. */
export function money(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `$${value}`;
}

/** Escapes text for interpolation into markup. */
export function escape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
      character
    ],
  );
}

/** The host of a URL, or an empty string. */
export function host(url) {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/** The path of a URL, or the URL itself. */
export function path(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url ?? "";
  }
}

/**
 * The Passport's error codes, in plain English.
 *
 * A judge should never have to know what "session_rule_exceeded" means.
 */
const PLAIN = {
  session_rule_exceeded:
    "over the cap you signed for a single purchase, so the Passport refused to release the money",
  session_total_exceeded:
    "would have taken the session past its total budget, so the Passport refused to release the money",
  separate_session_used_up:
    "the session had nothing left to spend, so nothing was sent",
  payment_target_forbidden:
    "the merchant is not on the Passport's allowlist, so the Passport would not pay it",
  session_endpoint_forbidden: "outside the endpoints the session allows",
  session_asset_forbidden: "the merchant wanted an asset the session does not allow",
  insufficient_balance: "the wallet did not hold enough",
  no_payment_requirement: "the merchant returned no payment request for that call",
  merchant_rejected: "the merchant refused the request",
  merchant_unavailable: "the merchant did not answer",
};

export function plainError(code) {
  if (!code) return "";
  return PLAIN[code] ?? "the Passport refused this purchase";
}

/** A status chip. The glyph is not the only cue; the word carries it. */
export function statusChip(kind, label) {
  const glyph = { settled: "●", refused: "▲", verified: "✓", fault: "✕", neutral: "○" }[
    kind
  ] ?? "○";
  return `<span class="status ${kind}"><span class="dot" aria-hidden="true"></span>${escape(
    glyph,
  )} ${escape(label)}</span>`;
}
