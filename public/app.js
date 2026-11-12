/**
 * The page controller.
 *
 * It decides which record to show and asks the renderers to draw it. It does
 * not know the shape of a proof payload; that is the data layer's business.
 */
import { fetchOurProof, fetchPublishedProof, logUrlFromLocation } from "./lib/api.js";
import {
  renderCost,
  renderRecord,
  renderSession,
  renderSubstitutions,
  renderSurfaces,
  renderVerification,
} from "./lib/render.js";

function show(id, visible) {
  const node = document.getElementById(id);
  if (node) node.hidden = !visible;
}

function setTitle(text) {
  document.title = text;
}

function fail(message) {
  const body = document.getElementById("record-body");
  if (body) {
    body.innerHTML = `<div class="state"><h3>The record could not be loaded</h3><p>${message}</p></div>`;
  }
  for (const id of ["cost-body", "subs-body", "verify-body"]) {
    const node = document.getElementById(id);
    if (node) node.innerHTML = "";
  }
}

async function main() {
  const publishedLog = logUrlFromLocation();

  if (publishedLog) {
    setTitle("Capsule — verifying a published record");
    document.querySelector("h1").innerHTML =
      "A spending record, <span class=\"accent\">checked</span> by someone who did not write it.";
    document.querySelector(".standfirst").innerHTML =
      "This log was published by somebody else. Capsule fetched it, checked its hash chain, " +
      "and read every payment off the chain. The owner keeps their data; nothing is stored here.";
    show("substitutions", false);
    try {
      const proof = await fetchPublishedProof(publishedLog);
      renderSession(proof);
      renderRecord(proof);
      renderVerification(proof);
      renderSurfaces(proof);
      show("cost", false);
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
    }
    return;
  }

  setTitle("Capsule — your agent's spending record");
  try {
    const proof = await fetchOurProof();
    renderSession(proof);
    renderRecord(proof);
    renderCost(proof);
    renderSubstitutions(proof);
    renderVerification(proof);
    renderSurfaces(proof);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    show("cost", false);
    show("substitutions", false);
  }
}

main();
