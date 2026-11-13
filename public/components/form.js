/**
 * Forms and runs.
 *
 * The log URL field, and the cards that list the recorded runs.
 */
import { html, raw } from "./dom.js";

/**
 * A single field with a button.
 *
 * The input is a native `url` input with a visible label, so the browser
 * checks it and a screen reader announces it. The label is visually hidden
 * but present, because a placeholder is not a label.
 *
 * @param {{
 *   id: string,
 *   name: string,
 *   label: string,
 *   placeholder?: string,
 *   buttonLabel?: string,
 *   hint?: string,
 * }} props
 * @returns {string}
 */
export function Field(props) {
  return html`<form class="field" id="${props.id}" novalidate>
    <label class="sr-only" for="${props.name}">${props.label}</label>
    <input
      id="${props.name}"
      name="${props.name}"
      type="url"
      inputmode="url"
      autocomplete="url"
      spellcheck="false"
      placeholder="${props.placeholder ?? ""}"
      aria-describedby="${props.name}-hint"
      required
    />
    <button type="submit" id="${props.name}-go">${props.buttonLabel ?? "Verify it"}</button>
    <p class="field-hint" id="${props.name}-hint">${props.hint ?? ""}</p>
  </form>`;
}

/**
 * One run, as a card.
 *
 * @param {{
 *   id: string,
 *   label: string,
 *   summary: string,
 *   head: string,
 *   figures: Array<{value: string, label: string}>,
 *   href: string,
 * }} props
 * @returns {string}
 */
export function RunCard(props) {
  return html`<a class="runcard" href="${props.href}">
    <div class="runcard-body">
      <div class="name">${props.label}</div>
      <div class="sub">${props.summary}</div>
      <div class="sub">head ${props.head}</div>
    </div>
    <div class="figures">
      ${props.figures.map(
        (figure) => html`<div class="fig">
          <div class="n">${figure.value}</div>
          <div class="k">${figure.label}</div>
        </div>`,
      )}
    </div>
  </a>`;
}

/**
 * The list of runs.
 *
 * @param {{runs: Array<Parameters<typeof RunCard>[0]>}} props
 * @returns {string}
 */
export function RunList(props) {
  if (!props.runs.length) {
    return html`<div class="state state-empty">
      <h3>No runs recorded</h3>
      <p>The receipts file is written by <code>npm run demo</code>.</p>
    </div>`;
  }
  return html`<div class="runlist">
    ${props.runs.map((run) => html`${raw(RunCard(run))}`)}
  </div>`;
}
