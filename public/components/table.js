/**
 * A table.
 *
 * One component, so every table on the site is built the same way and every
 * table degrades the same way on a narrow screen: the header row is hidden
 * and each cell becomes a block.
 *
 * @param {{
 *   head: string[],
 *   rows: Array<Array<string | {html: string}>>,
 *   caption?: string,
 *   columnClass?: (index: number) => string,
 * }} props
 * @returns {string}
 */
import { html } from "./dom.js";

export function DataTable(props) {
  const cell = (value) =>
    value && typeof value === "object" && "html" in value ? value.html : String(value ?? "");
  return html`<table class="checks">
    ${props.caption
      ? html`<caption class="sr-only">${props.caption}</caption>`
      : ""}
    <thead>
      <tr>
        ${props.head.map((label) => html`<th scope="col">${label}</th>`)}
      </tr>
    </thead>
    <tbody>
      ${props.rows.map(
        (row) => html`<tr>
          ${row.map(
            (value, index) =>
              html`<td class="${props.columnClass?.(index) ?? ""}">${cell(value)}</td>`,
          )}
        </tr>`,
      )}
    </tbody>
  </table>`;
}
