/**
 * Status.
 *
 * A status is never carried by colour alone. Every chip has a word, and every
 * word has a shape: a filled dot for money that moved, a triangle for money
 * that did not, a tick for something the chain confirmed, a cross for a
 * genuine failure, a ring for something we could not read.
 *
 * The colour is a second channel, for the people who read faster that way.
 */
import { escape, html } from "./dom.js";

/** The statuses the product knows about. */
export const STATUS = {
  /** Money left the owner's wallet. */
  settled: { kind: "settled", glyph: "●", label: "settled" },
  /** Money stayed: the limit held. */
  refused: { kind: "refused", glyph: "▲", label: "refused" },
  /** Checked against the chain. */
  verified: { kind: "verified", glyph: "✓", label: "verified" },
  /** A genuine failure. */
  fault: { kind: "fault", glyph: "✕", label: "did not match" },
  /** We could not read it. Not the same as a failure. */
  neutral: { kind: "neutral", glyph: "○", label: "could not read" },
  /** A step we could not classify at all. */
  unread: { kind: "neutral", glyph: "○", label: "unread" },
};

/**
 * A status chip.
 *
 * @param {{kind?: string, label?: string}} props
 * @returns {string}
 */
export function StatusChip(props) {
  const known = STATUS[props.kind ?? "neutral"] ?? STATUS.neutral;
  const label = props.label ?? known.label;
  return html`<span class="status ${known.kind}">
    <span class="glyph" aria-hidden="true">${known.glyph}</span>
    <span class="status-label">${label}</span>
  </span>`;
}

/**
 * A plain tag, for things that are not statuses.
 *
 * @param {{text: string, tone?: "quiet" | "accent"}} props
 * @returns {string}
 */
export function Tag(props) {
  return html`<span class="tag ${props.tone ?? "quiet"}">${props.text}</span>`;
}

/**
 * The outcome of a chain check.
 *
 * @param {{outcome?: string}} props
 * @returns {string}
 */
export function ChainOutcome(props) {
  const outcome = props.outcome ?? "unavailable";
  if (outcome === "confirmed") {
    return StatusChip({ kind: "verified", label: "confirmed" });
  }
  if (outcome === "mismatch") {
    return StatusChip({ kind: "fault", label: "did not match" });
  }
  return StatusChip({ kind: "neutral", label: "could not read" });
}
