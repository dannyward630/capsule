/**
 * The gallery.
 *
 * The gallery is how the component library documents itself: each component
 * is rendered with its real props, so the usage examples cannot drift from
 * the code the way prose examples do.
 *
 * It is a component like any other — a function from props to markup — so
 * the gallery page is a controller that holds the examples, not a place that
 * assembles markup.
 */
import { html, raw } from "./dom.js";

/**
 * One example: the component's name, its props, and the component itself.
 *
 * @param {{name: string, props: string, example: string}} props
 * @returns {string}
 */
export function GalleryBlock(props) {
  return html`<section class="demo">
    <h4>${props.name}</h4>
    <p class="props">${props.props}</p>
    ${raw(props.example)}
  </section>`;
}

/**
 * The whole gallery.
 *
 * @param {{examples: Array<{name: string, props: string, example: string}>}} props
 * @returns {string}
 */
export function GalleryGrid(props) {
  if (!props.examples.length) {
    return html`<div class="state state-empty">
      <h3>No examples</h3>
      <p>The gallery is empty.</p>
    </div>`;
  }
  return html`${props.examples.map((example) => raw(GalleryBlock(example)))}`;
}
