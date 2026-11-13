/**
 * One run.
 *
 * The same renderers the owner's page uses, so a run and the record cannot
 * disagree about what a run says. The only difference is where the proof comes
 * from: /runs/<id>.json instead of /proof.json.
 */
import {
  renderCost,
  renderRecord,
  renderSession,
  renderVerification,
} from "./lib/render.js";

const id = new URLSearchParams(window.location.search).get("id") ?? "recorded";

async function load() {
  const body = document.getElementById("record-body");
  try {
    const response = await fetch(`/runs/${encodeURIComponent(id)}.json`, {
      headers: { accept: "application/json" },
    });
    const proof = await response.json();
    if (!response.ok) {
      throw new Error(proof.message ?? `the run "${id}" could not be loaded`);
    }
    document.title = `Capsule — ${
      id === "contrast" ? "the contrast run" : "the recorded run"
    }`;
    document.getElementById("title").innerHTML =
      id === "contrast"
        ? 'The same task, <span class="accent">a larger limit</span>.'
        : 'The recorded run, <span class="accent">under the tight cap</span>.';
    document.getElementById("standfirst").textContent =
      id === "contrast"
        ? "The only thing that changed is the number the user signed. This run bought the $0.05 endpoint the tight cap refused."
        : "The task, the agent and the $0.0025 the user signed. Two purchases settled, two were refused.";

    renderSession(proof);
    renderRecord(proof);
    renderCost(proof);
    renderVerification(proof);
  } catch (error) {
    if (body) {
      body.innerHTML = `<div class="state"><h3>The run could not be loaded</h3><p>${
        error instanceof Error ? error.message : String(error)
      }</p></div>`;
    }
  }
}

load();
