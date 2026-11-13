/**
 * The trace page.
 *
 * It shows the check happening rather than the answer it produced. A reader
 * who sees "fetched → parsed → hash chain intact → 2 transfers confirmed on
 * Base → 2 refusals → the limit cost" learns something they would not learn
 * from a JSON blob: that the check is real, and what it does and does not
 * cover.
 */
import { fetchPublishedProof } from "./lib/api.js";
import { renderRecord, renderVerification } from "./lib/render.js";

const form = document.getElementById("form");
const input = document.getElementById("log-url");
const go = document.getElementById("go");
const body = document.getElementById("trace-body");

function show(id, visible) {
  const node = document.getElementById(id);
  if (node) node.hidden = !visible;
}

function escape(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
}

/** The check, step by step. */
function renderTrace(proof) {
  const steps = proof.trace ?? [];
  if (!steps.length) {
    body.innerHTML =
      '<div class="state"><p>The check produced no steps.</p></div>';
    return;
  }
  const glyph = { ok: "✓", warn: "!", fail: "✕", info: "i" };
  body.innerHTML = `<ol class="trace">${steps
    .map(
      (step) => `<li class="${escape(step.state)}">
        <span class="mark" aria-hidden="true">${escape(glyph[step.state] ?? "·")}</span>
        <div class="what">
          <div class="label">${escape(step.label)}</div>
          <div class="detail">${escape(step.detail)}</div>
        </div>
      </li>`,
    )
    .join("")}</ol>`;
}

function fail(message) {
  body.innerHTML = `<div class="state"><h3>The log could not be verified</h3><p>${escape(
    message,
  )}</p></div>`;
  show("record", false);
  show("verification", false);
}

async function verify(url) {
  go.disabled = true;
  body.innerHTML = '<div class="state"><p>Fetching the log…</p></div>';
  try {
    const proof = await fetchPublishedProof(url);
    renderTrace(proof);
    renderRecord(proof);
    renderVerification(proof);
    show("record", true);
    show("verification", true);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  } finally {
    go.disabled = false;
  }
}

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const url = input.value.trim();
  if (!url) return;
  const next = new URL(window.location.href);
  next.searchParams.set("log", url);
  window.history.replaceState({}, "", next);
  verify(url);
});

const fromUrl = new URLSearchParams(window.location.search).get("log");
if (fromUrl) {
  input.value = fromUrl;
  verify(fromUrl);
}
