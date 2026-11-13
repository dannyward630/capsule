/**
 * The trace.
 *
 * The check, step by step, so a reader watches it happen instead of being
 * asked to trust a blob of JSON. Each step is one line of work with its
 * finding, and the state carries the meaning: ok, warn, fail, or info.
 */
import { html, raw } from "./dom.js";

const GLYPH = { ok: "✓", warn: "!", fail: "✕", info: "i" };

/**
 * One step.
 *
 * @param {{label: string, detail: string, state?: "ok"|"warn"|"fail"|"info"}} props
 * @returns {string}
 */
export function TraceStep(props) {
  const state = props.state ?? "info";
  return html`<li class="${state}">
    <span class="mark" aria-hidden="true">${GLYPH[state] ?? "·"}</span>
    <div class="what">
      <div class="label">${props.label}</div>
      <div class="detail">${props.detail}</div>
    </div>
  </li>`;
}

/**
 * The whole trace.
 *
 * @param {{steps: Array<Parameters<typeof TraceStep>[0]>, label?: string}} props
 * @returns {string}
 */
export function TraceList(props) {
  if (!props.steps.length) {
    return html`<div class="state state-empty">
      <h3>The check produced no steps</h3>
      <p>That is not something we can explain. Try the log again.</p>
    </div>`;
  }
  return html`<ol class="trace" role="list" aria-label="${props.label ?? "The check, step by step"}">
    ${props.steps.map((step) => html`${raw(TraceStep(step))}`)}
  </ol>`;
}
