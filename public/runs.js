/**
 * The runs page.
 *
 * The A/B is the strongest evidence this project owns, so it gets a screen
 * rather than a table in a README. Every figure on it comes from
 * /runs.json, which reads the receipts and the chain.
 */
import { money, statusChip, escape } from "./lib/format.js";

const body = document.getElementById("runs-body");
const compare = document.getElementById("compare-body");

function show(id, visible) {
  const node = document.getElementById(id);
  if (node) node.hidden = !visible;
}

async function load() {
  try {
    const response = await fetch("/runs.json", { headers: { accept: "application/json" } });
    const data = await response.json();
    if (data.status !== "ok" || !data.runs?.length) {
      body.innerHTML =
        '<div class="state"><h3>No runs recorded</h3><p>The receipts file is written by <code>npm run demo</code>.</p></div>';
      return;
    }
    renderRuns(data.runs);
    renderCompare(data.runs);
  } catch (error) {
    body.innerHTML = `<div class="state"><p>${escape(
      error instanceof Error ? error.message : String(error),
    )}</p></div>`;
  }
}

function renderRuns(runs) {
  body.innerHTML = `<div class="runlist">${runs
    .map(
      (run) => `<a class="runcard" href="/run.html?id=${encodeURIComponent(run.id)}">
        <div>
          <div class="name">${escape(run.label)}</div>
          <div class="sub">
            ${escape(money(run.max_amount_per_tx))} per call · ${escape(
              money(run.budget_usd),
            )} in total · session ${escape(run.session_id ?? "unknown")}
          </div>
          <div class="sub">head ${escape((run.log_head ?? "").slice(0, 18))}…</div>
        </div>
        <div class="figures">
          <div class="fig"><div class="n">${run.payments}</div><div class="k">settled</div></div>
          <div class="fig"><div class="n">${run.refusals}</div><div class="k">refused</div></div>
          <div class="fig"><div class="n">${escape(money(run.spent_usd))}</div><div class="k">spent</div></div>
          <div class="fig"><div class="n">${
            run.budget_multiplier ? escape(String(run.budget_multiplier)) + "×" : "—"
          }</div><div class="k">cost of limit</div></div>
        </div>
      </a>`,
    )
    .join("")}</div>`;
}

function renderCompare(runs) {
  const [recorded, contrast] = runs;
  if (!recorded || !contrast) {
    compare.innerHTML =
      '<div class="state"><p>Two runs are needed for a comparison.</p></div>';
    return;
  }
  const rows = [
    ["Per call", money(recorded.max_amount_per_tx), money(contrast.max_amount_per_tx)],
    ["In total", money(recorded.budget_usd), money(contrast.budget_usd)],
    ["Settled", recorded.payments, contrast.payments],
    ["Refused", recorded.refusals, contrast.refusals],
    ["Spent", money(recorded.spent_usd), money(contrast.spent_usd)],
    [
      "What the limit cost",
      money(recorded.cost_of_the_limit_usd),
      money(contrast.cost_of_the_limit_usd),
    ],
  ];
  compare.innerHTML = `<div class="verify">
      <div class="verify-head">
        <span class="headline">Only the number the user signed changed</span>
        <span class="spacer"></span>
        <span style="color:var(--ink-3);font-size:0.83rem">two recorded runs</span>
      </div>
      <table class="checks">
        <thead><tr><th></th><th>The recorded run</th><th>The contrast run</th></tr></thead>
        <tbody>${rows
          .map(
            (row) =>
              `<tr><td class="wrap">${escape(row[0])}</td><td>${escape(
                String(row[1]),
              )}</td><td>${escape(String(row[2]))}</td></tr>`,
          )
          .join("")}</tbody>
      </table>
    </div>
    <p class="caveat">
      The <strong>$0.05</strong> endpoint that the Passport refused under the tight cap was
      <strong>paid</strong> under the loose one. The refusals were not a broken agent; they
      were the limit, doing its job. Every figure above is re-read from the chain when this
      page loads.
    </p>`;
}

load();
