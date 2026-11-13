/**
 * The record.
 *
 * One row per attempt, in order, with the outcome, the price and what the
 * model said it wanted the purchase for. The reasoning is in the signed log,
 * so it is shown with the rest of the record rather than kept behind a click.
 */
import { html, raw } from "./dom.js";
import { StatusChip } from "./status.js";

/**
 * One attempt.
 *
 * @param {{
 *   n: number,
 *   path: string,
 *   host: string,
 *   service?: string,
 *   price: string,
 *   outcome: "paid" | "refused" | "other",
 *   reason?: string,
 *   fact?: string | null,
 *   thinking?: string | null,
 *   tx?: {hash: string, explorer: string, confirmations?: number | null, recipient?: string | null} | null,
 *   errorCode?: string | null,
 *   meta?: string[],
 * }} props
 * @returns {string}
 */
export function RecordRow(props) {
  const paid = props.outcome === "paid";
  const chip =
    props.outcome === "paid"
      ? StatusChip({ kind: "settled" })
      : props.outcome === "refused"
        ? StatusChip({ kind: "refused" })
        : StatusChip({ kind: "unread" });

  const thinking =
    props.fact || props.thinking
      ? html`<div class="why-model">
          ${props.fact ? html`<span class="fact">For: ${props.fact}</span><br />` : ""}
          ${props.thinking ? html`&ldquo;${props.thinking}&rdquo;` : ""}
        </div>`
      : "";

  const items = [];
  if (props.tx) {
    items.push(
      html`<a href="${props.tx.explorer}/tx/${props.tx.hash}" target="_blank" rel="noreferrer">tx ${props.tx.hash.slice(0, 12)}…</a>`,
    );
    if (props.tx.confirmations != null) {
      items.push(html`<span>${props.tx.confirmations} confirmations</span>`);
    }
    if (props.tx.recipient) {
      items.push(html`<span>to ${props.tx.recipient.slice(0, 10)}…</span>`);
    }
  }
  if (props.errorCode) items.push(html`<span>${props.errorCode}</span>`);
  const meta = items.length
    ? html`<div class="meta">${items.map((item) => html`<span>${item}</span>`)}</div>`
    : "";

  return html`<li>
    <span class="seq">${props.n}</span>
    <div class="what">
      <div class="target">
        ${props.path}${props.host ? html` <span class="host">· ${props.host}</span>` : ""}
      </div>
      ${props.reason ? html`<div class="why"><span class="plain">${props.reason}</span></div>` : ""}
      ${raw(thinking)}
      ${raw(meta)}
    </div>
    <div class="price">
      ${raw(chip)}
      <div class="amount">${props.price}</div>
    </div>
  </li>`;
}

/**
 * The whole record.
 *
 * @param {{rows: Array<Parameters<typeof RecordRow>[0]>, countLabel?: string}} props
 * @returns {string}
 */
export function RecordList(props) {
  if (!props.rows.length) {
    return html`<div class="state state-empty">
      <h3>No attempts recorded</h3>
      <p>
        The run produced no purchase and no refusal. That is a different failure from
        &ldquo;nothing spent&rdquo;.
      </p>
    </div>`;
  }
  return html`<ol class="record">
    ${props.rows.map((row) => html`${raw(RecordRow(row))}`)}
  </ol>`;
}
