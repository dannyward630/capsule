/**
 * The runs.
 *
 * The A/B is the strongest evidence this project owns, so it gets a screen
 * rather than a table in a README.
 */
import { fetchRuns } from "./lib/api.js";
import { DataTable, Panel, RunList, failed, mount } from "./components/index.js";

function render(runs) {
  mount(
    "runs-body",
    RunList({
      runs: runs.map((run) => ({
        id: run.id,
        label: run.label,
        summary: `$${run.max_amount_per_tx} per call · $${run.budget_usd} in total · session ${
          run.session_id ?? "unknown"
        }`,
        head: `${(run.log_head ?? "").slice(0, 18)}…`,
        href: `/run.html?id=${encodeURIComponent(run.id)}`,
        figures: [
          { value: String(run.payments), label: "settled" },
          { value: String(run.refusals), label: "refused" },
          { value: `$${run.spent_usd}`, label: "spent" },
          {
            value: run.budget_multiplier ? `${run.budget_multiplier}×` : "—",
            label: "cost of limit",
          },
        ],
      })),
    }),
  );
}

function renderCompare(runs) {
  const [recorded, contrast] = runs;
  if (!recorded || !contrast) {
    mount(
      "compare-body",
      Panel({
        head: "Two runs are needed for a comparison",
        body: '<p class="caveat">Only one run has been recorded.</p>',
      }),
    );
    return;
  }
  const rows = [
    ["Per call", `$${recorded.max_amount_per_tx}`, `$${contrast.max_amount_per_tx}`],
    ["In total", `$${recorded.budget_usd}`, `$${contrast.budget_usd}`],
    ["Settled", String(recorded.payments), String(contrast.payments)],
    ["Refused", String(recorded.refusals), String(contrast.refusals)],
    ["Spent", `$${recorded.spent_usd}`, `$${contrast.spent_usd}`],
    [
      "What the limit cost",
      `$${recorded.cost_of_the_limit_usd}`,
      `$${contrast.cost_of_the_limit_usd}`,
    ],
  ];
  mount(
    "compare-body",
    `${Panel({
      head: "Only the number the user signed changed",
      note: "two recorded runs",
      body: DataTable({
        head: ["", "The recorded run", "The contrast run"],
        rows,
        columnClass: (index) => (index === 0 ? "wrap" : ""),
      }),
    })}
     <p class="caveat">
      The <strong>$0.05</strong> endpoint that the Passport refused under the tight cap was
      <strong>paid</strong> under the loose one. The refusals were not a broken agent; they
      were the limit, doing its job. These figures are the record of what happened; each run's
      own page carries the chain checks, read from the chain.
    </p>`,
  );
}

async function load() {
  try {
    const data = await fetchRuns();
    if (data.status !== "ok" || !data.runs?.length) {
      mount(
        "runs-body",
        '<div class="state state-empty"><h3>No runs recorded</h3><p>The receipts file is written by <code>npm run demo</code>.</p></div>',
      );
      return;
    }
    render(data.runs);
    renderCompare(data.runs);
  } catch (error) {
    mount(
      "runs-body",
      failed("The runs could not be loaded", error instanceof Error ? error.message : String(error), {
        onRetry: () => window.location.reload(),
      }),
    );
  }
}

load();
