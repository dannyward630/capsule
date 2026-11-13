/**
 * The primitives every component is built from.
 *
 * A component is a function that takes plain props and returns markup. There
 * is no framework and no build step: the deployment serves these modules as
 * they are, and a bundler would break that.
 *
 * The rule every component follows: it knows about markup and nothing else.
 * It does not know the shape of a proof payload, and it does not fetch
 * anything. `lib/compose.js` turns a payload into props; a component turns
 * props into markup. That is the whole separation, and it is why a component
 * can be used on any page.
 */

/**
 * Escapes text for interpolation into markup.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escape(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
}

/**
 * A tagged template that escapes every interpolated value by default.
 *
 * Markup is built by composition, and every part of it comes from a log or a
 * chain response. Escaping at the point of interpolation means a component
 * cannot forget to.
 *
 * `html`<a href="${url}">${label}</a>`` is safe by construction.
 * To embed markup that is already trusted, use `raw()`:
 *
 *   html`<div>${raw(trustedMarkup)}</div>`
 *
 * @param {TemplateStringsArray} strings
 * @param {...unknown} values
 * @returns {string}
 */
export function html(strings, ...values) {
  return strings.reduce((out, chunk, index) => {
    if (index === 0) return chunk;
    const value = values[index - 1];
    const rendered =
      value && typeof value === "object" && "html" in value
        ? String(value.html)
        : escape(value);
    return out + rendered + chunk;
  }, "");
}

/**
 * Marks markup as already trusted, so `html` does not escape it.
 *
 * Only use it on markup this codebase produced.
 *
 * @param {string} markup
 * @returns {{html: string}}
 */
export function raw(markup) {
  return { html: String(markup ?? "") };
}

/**
 * Puts markup into an element.
 *
 * @param {string} id
 * @param {string} markup
 * @returns {boolean} whether the element was found
 */
export function mount(id, markup) {
  const node = document.getElementById(id);
  if (!node) return false;
  node.innerHTML = markup;
  return true;
}

/**
 * Shows or hides a section by its id.
 *
 * @param {string} id
 * @param {boolean} visible
 */
export function showSection(id, visible) {
  const node = document.getElementById(id);
  if (node) node.hidden = !visible;
}

/**
 * A placeholder for a region that is still loading.
 *
 * It is announced, so a screen reader knows the page is working.
 *
 * @param {string} message
 * @returns {string}
 */
export function loading(message) {
  return html`<div class="state" role="status" aria-live="polite">
    <p>${message}</p>
  </div>`;
}

/**
 * A region that failed, with the message and a way to try again.
 *
 * @param {string} heading
 * @param {string} message
 * @param {{label?: string, onRetry?: () => void}} [options]
 * @returns {string}
 */
export function failed(heading, message, options = {}) {
  const retry = options.onRetry
    ? html`<button class="retry" type="button" data-retry>${options.label ?? "Try again"}</button>`
    : "";
  return html`<div class="state state-failed" role="alert">
    <h3>${heading}</h3>
    <p>${message}</p>
    ${retry}
  </div>`;
}

/**
 * An empty region: nothing to show, and that is a fact, not a failure.
 *
 * @param {string} heading
 * @param {string} message
 * @returns {string}
 */
export function empty(heading, message) {
  return html`<div class="state state-empty">
    <h3>${heading}</h3>
    <p>${message}</p>
  </div>`;
}
