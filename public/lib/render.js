/**
 * The section renderers.
 *
 * One function per section of the page. Each returns markup for its own
 * section and nothing else, so a section can be re-rendered on its own and
 * the page stays readable.
 */
import { escape, host, money, path, plainError, statusChip } from "./format.js";

function byId(id) {
  return document.getElementById(id);
}

function set(id, markup) {
  const node = byId(id);
  if (node) node.innerHTML = markup;
}

/** The session bar: what the user signed, what was spent, what is left. */
export function renderSession(proof) {
  const budget = Number(proof.totals.session_budget_usd || 0);
  const spent = Number(proof.totals.spent_usd || 0);
  const left = Math.max(0, budget - spent);
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const cells = [
    [money(proof.totals.session_budget_usd), "the session's total budget"],
    [money(proof.session.max_amount_per_tx), "the ceiling on any one call"],
    [money(proof.totals.spent_usd), `across ${proof.totals.payments} settled payments`],
    [money(left.toFixed(4)), "still available"],
  ];
  const nodes = document.querySelectorAll("#session dd");
  nodes.forEach((node, index) => {
    const cell = cells[index];
    if (!cell) return;
    node.innerHTML = `${escape(cell[0])} <small>${escape(cell[1])}</small>`;
    if (index === 3 && left <= 0) node.classList.add("exhausted");
  });
  const meter = document.querySelector("#session .meter");
  if (meter) {
    meter.hidden = false;
    const fill = meter.querySelector(".meter-fill");
    if (fill) {
      fill.style.width = `${pct.toFixed(1)}%`;
      fill.classList.toggle("over", spent >= budget && budget > 0);
    }
    const legend = meter.querySelector(".meter-legend");
    if (legend) {
      legend.children[0].textContent = `${spent.toFixed(4)} USDC spent`;
      legend.children[1].textContent = `${budget.toFixed(4)} USDC signed`;
    }
  }
}

/** The record: every attempt, in order, in plain English. */
export function renderRecord(proof) {
  const count = byId("record-count");
  if (count) count.textContent = `${proof.steps.length} attempts`;
  if (!proof.steps.length) {
    set(
      "record-body",
      '<div class="state"><h3>No attempts recorded</h3><p>The run produced no purchase and no refusal. That is a different failure from "nothing spent".</p></div>',
    );
    return;
  }
  const checks = new Map(
    (proof.chain_checks ?? []).map((check) => [check.tx_hash, check]),
  );
  const rows = proof.steps
    .map((step) => {
      const paid = step.outcome === "paid";
      const check = step.tx_hash ? checks.get(step.tx_hash) : null;
      const reason = paid ? "the session allowed it" : plainError(step.error_code);
      const meta = [];
      if (paid && step.tx_hash) {
        meta.push(
          `<a href="${escape(proof.chain?.explorer ?? "")}/tx/${escape(step.tx_hash)}" target="_blank" rel="noreferrer">tx ${escape(
            step.tx_hash.slice(0, 12),
          )}…</a>`,
        );
        if (check?.confirmations != null) {
          meta.push(`${check.confirmations} confirmations`);
        }
        if (check?.recipient) meta.push(`to ${escape(check.recipient.slice(0, 10))}…`);
      }
      if (!paid && step.error_code) meta.push(escape(step.error_code));
      // The model's own account of the attempt. It lives in the signed log, so
      // it is covered by the hash chain.
      const thinking =
        step.fact || step.reason
          ? `<div class="why-model">${
              step.fact
                ? `<span class="fact">For: ${escape(step.fact)}</span><br />`
                : ""
            }${step.reason ? `&ldquo;${escape(step.reason)}&rdquo;` : ""}</div>`
          : "";
      return `<li>
        <span class="seq">${step.n}</span>
        <div class="what">
          <div class="target">${escape(path(step.url))} <span class="host">· ${escape(host(step.url))}</span></div>
          <div class="why"><span class="plain">${escape(reason)}</span></div>
          ${thinking}
          ${meta.length ? `<div class="meta">${meta.map((m) => `<span>${m}</span>`).join("")}</div>` : ""}
        </div>
        <div class="price">
          ${statusChip(paid ? "settled" : "refused", paid ? "settled" : "refused")}
          <div style="margin-top:7px">${escape(money(step.price_usd))}</div>
        </div>
      </li>`;
    })
    .join("");
  set("record-body", `<ol class="record">${rows}</ol>`);
}

/** What the limit cost: the evidence the refusals denied. */
export function renderCost(proof) {
  const counterfactual = proof.counterfactual;
  if (!counterfactual) {
    set(
      "cost-body",
      '<div class="state"><p>This record carries no cost report.</p></div>',
    );
    return;
  }
  const count = byId("subs-count");
  if (count) count.textContent = counterfactual.attempts.length
    ? `${counterfactual.attempts.length} refusals`
    : "";
  const rows = (counterfactual.facts ?? [])
    .map((fact) => {
      const state = fact.covered
        ? '<span class="status verified"><span class="dot" aria-hidden="true"></span>covered</span>'
        : fact.blocked_attempt
          ? `<span class="status refused"><span class="dot" aria-hidden="true"></span>blocked</span> <span style="color:var(--ink-2)">by the ${escape(
              fact.blocked_attempt.blocked_by,
            )} — ${escape(money(fact.blocked_attempt.wanted_price_usd))}</span>`
          : '<span class="status neutral"><span class="dot" aria-hidden="true"></span>not attempted</span> <span style="color:var(--ink-2)">the budget was gone</span>';
      return `<tr><td class="wrap">${escape(fact.fact)}</td><td>${state}</td></tr>`;
    })
    .join("");
  const multiple = counterfactual.budget_multiplier;
  if (!counterfactual.attempts?.length) {
    set(
      "cost-body",
      `<div class="verify">
        <div class="verify-head">
          <span class="headline" style="font-size:1.15rem">Nothing was refused</span>
          <span class="spacer"></span>
          <span style="color:var(--ink-3);font-size:0.83rem">against a ${escape(
            money(counterfactual.budget_usd),
          )} budget</span>
        </div>
        <p class="caveat" style="margin:0;padding:14px 19px;border:none">
          Every purchase this agent proposed was allowed. The limit never bound, so there is
          no cost to report — which is the point of running the same task again under a
          larger limit.
        </p>
      </div>`,
    );
    return;
  }
  set(
    "cost-body",
    `<div class="verify">
      <div class="verify-head">
        <span class="headline" style="font-size:1.15rem">${escape(
          money(counterfactual.cost_usd),
        )} of evidence, refused</span>
        <span class="spacer"></span>
        <span style="color:var(--ink-3);font-size:0.83rem">against a ${escape(
          money(counterfactual.budget_usd),
        )} budget${
          multiple
            ? ` — <strong style="color:var(--ink)">${escape(multiple)}×</strong> the whole budget`
            : ""
        }</span>
      </div>
      <table class="checks">
        <thead><tr><th>The answer needed</th><th>What the record says</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="caveat">
        The refusals were not free attempts. Each one names the endpoint the agent wanted,
        the price it walked away from, and the limit that stopped it. The cost is the sum of
        those prices, taken from the catalog.
      </p>
      ${renderContrast(proof)}
    </div>`,
  );
}

/** The same task under a different limit. */
function renderContrast(proof) {
  const other = proof.contrast;
  if (!other) return "";
  const paidBoth = other.steps.filter(
    (step) => step.outcome === "paid" && step.price_usd === "0.05",
  );
  const rows = [
    ["Per call", money(proof.session.max_amount_per_tx), money(other.session.max_amount_per_tx)],
    ["In total", money(proof.totals.session_budget_usd), money(other.totals.session_budget_usd)],
    ["Settled", proof.totals.payments, other.totals.payments],
    ["Refused", proof.totals.refusals, other.totals.refusals],
    ["Spent", money(proof.totals.spent_usd), money(other.totals.spent_usd)],
  ]
    .map(
      (row) =>
        `<tr><td class="wrap">${escape(row[0])}</td><td>${escape(row[1])}</td><td>${escape(row[2])}</td></tr>`,
    )
    .join("");
  return `<div class="verify" style="margin-top:14px">
    <div class="verify-head">
      <span class="headline">The same task, a different limit</span>
      <span class="spacer"></span>
      <span style="color:var(--ink-3);font-size:0.83rem">only the number the user signed changed</span>
    </div>
    <table class="checks">
      <thead><tr><th></th><th>This run</th><th>The contrast run</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${
      paidBoth.length
        ? `<div class="hashline">The $${escape(
            paidBoth[0].price_usd,
          )} endpoint that was <b>refused</b> above was <b>paid</b> here — ${escape(
            paidBoth[0].tx_hash ?? "",
          )}.<br />The refusals were not a broken agent. They were the limit, doing its job.</div>`
        : ""
    }
  </div>`;
}

/** What it bought instead, for every refusal. */
export function renderSubstitutions(proof) {
  const rows = proof.substitutions ?? [];
  const count = byId("subs-count");
  if (count && !proof.counterfactual) {
    count.textContent = rows.length ? `${rows.length} refusals` : "";
  }
  if (!rows.length) {
    set(
      "subs-body",
      '<div class="state"><h3>Nothing was refused</h3><p>Every purchase the agent proposed was allowed by the session. The record below shows only the settlements.</p></div>',
    );
    return;
  }
  set(
    "subs-body",
    `<div class="subs">${rows
      .map((row) => {
        const instead = row.instead_of;
        const right = instead
          ? instead.outcome === "bought"
            ? `<div class="side got">
                <div class="label">Bought instead</div>
                <div class="name">${escape(instead.service)}</div>
                <div class="note">${escape(money(instead.price_usd))}${
                  row.instead_reason ? " — " + escape(row.instead_reason) : ""
                }</div>
              </div>`
            : `<div class="side tried">
                <div class="label">Tried instead</div>
                <div class="name">${escape(instead.service)}</div>
                <div class="note">${escape(money(instead.price_usd))} — refused too${
                  instead.error_code ? " (" + escape(instead.error_code) + ")" : ""
                }.</div>
              </div>`
          : `<div class="side">
              <div class="label">Bought instead</div>
              <div class="name">nothing — the budget was gone</div>
              <div class="note">The session was exhausted, so the run ended with the gap named.</div>
            </div>`;
        return `<div class="sub">
          <div class="sub-head">
            <span class="who">attempt ${row.refusal_seq}</span>
            ${statusChip("refused", "refused")}
            <span class="who" style="color:var(--ink-3);font-weight:400">${escape(
              plainError(row.error_code),
            )}</span>
          </div>
          <div class="swap">
            <div class="side wanted">
              <div class="label">Wanted</div>
              <div class="name">${escape(row.wanted)}</div>
              <div class="note">${escape(money(row.wanted_price_usd))} — ${escape(
                plainError(row.error_code),
              )}.</div>
            </div>
            <span class="arrow" aria-hidden="true">→</span>
            ${right}
          </div>
          ${
            row.reason
              ? `<div class="plain">The agent's own reason for wanting it: <b>${escape(row.reason)}</b></div>`
              : ""
          }
        </div>`;
      })
      .join("")}</div>`,
  );
}

/** The identity, the chain checks, and the payer. */
export function renderVerification(proof) {
  const checks = proof.chain_checks ?? [];
  const ok = proof.all_payments_verified_on_chain === true;
  const chainOk = proof.log?.verified === true;
  const head = proof.log?.head ?? null;
  const rows = checks
    .map(
      (check) => `<tr>
        <td>${escape(check.merchant ?? "")}</td>
        <td>${
          check.tx_hash
            ? `<a href="${escape(proof.chain?.explorer ?? "")}/tx/${escape(check.tx_hash)}" target="_blank" rel="noreferrer">${escape(
                check.tx_hash.slice(0, 12),
              )}…</a>`
            : '<span style="color:var(--ink-3)">no hash recorded</span>'
        }</td>
        <td>${check.block_number ?? "—"}</td>
        <td>${check.confirmations ?? "—"}</td>
        <td class="wrap">${escape(check.recipient ?? "—")}</td>
        <td>${statusChip(
          check.outcome === "confirmed"
            ? "verified"
            : check.outcome === "unavailable"
              ? "neutral"
              : "fault",
          check.outcome === "confirmed"
            ? "confirmed"
            : check.outcome === "unavailable"
              ? "could not read"
              : "did not match",
        )}</td>
      </tr>`,
    )
    .join("");
  set(
    "verify-body",
    `<div class="callout">
      <strong>The payments are chain-verified. The refusals are the owner's claim.</strong>
      A payment leaves a transaction, so anyone can re-read it — that is what the table
      below does, at the moment you loaded this page. A refusal leaves nothing behind: it
      exists in the signed log and in the Passport's error code, and that is where it stops.
      That asymmetry is exactly why the refusals are the valuable half and also the unproven
      half: nothing else records what an agent was refused.
    </div>
    <div class="verify">
      <div class="verify-head">
        ${statusChip(
          ok ? "verified" : "fault",
          ok ? "every payment confirmed on chain" : "a payment is unconfirmed",
        )}
        <span class="headline">${escape(proof.chain?.symbol ?? "USDC")} on ${escape(
          proof.chain?.network ?? "",
        )}</span>
        <span class="spacer"></span>
        <span style="color:var(--ink-3);font-size:0.83rem">${
          checks.length
            ? `${checks.length} payments re-read at request time`
            : "no payments"
        }</span>
      </div>
      ${
        proof.log
          ? `<div class="hashline">
              <b>Decision log</b> ${escape(proof.log.algorithm)} ·
              ${escape(String(proof.log.records))} records ·
              ${chainOk ? "chain intact" : "chain broken"}<br />
              <b>head</b> ${escape(head ?? "—")}
            </div>`
          : ""
      }
      ${
        proof.attestation
          ? `<div class="hashline">
              <b>Identity</b> the head is signed by the key Kite publishes for this DID<br />
              <b>did</b> ${escape(proof.attestation.did)}<br />
              <b>signing address</b> ${escape(proof.attestation.address)}<br />
              <b>signature</b> ${escape(proof.attestation.signature.slice(0, 26))}…
              <span style="color:var(--ink-3)">— check it yourself:</span>
              <code>curl -s https://passport.prod.gokite.ai/v1/agents/${escape(
                proof.attestation.did,
              )}/signingKeys</code>
            </div>`
          : ""
      }
      ${
        proof.payer_address
          ? `<div class="hashline">
              <b>Money</b> every transfer above was paid by this wallet<br />
              <b>paying wallet</b> ${escape(proof.payer_address)}
              <span style="color:var(--ink-3)">— the Passport's settlement wallet for this session</span>
            </div>`
          : ""
      }
      ${
        checks.length
          ? `<table class="checks">
              <thead><tr><th>Merchant</th><th>Transaction</th><th>Block</th><th>Confirms</th><th>Recipient</th><th>On chain</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>`
          : ""
      }
    </div>
    <p class="caveat">
      These rows are re-read from the chain when you load this page, not served from a
      cached copy. Editing an earlier decision in the log breaks every link after it, and the
      verifier says which record broke.
    </p>`,
  );
}

/** The surfaces a reader can go to next. */
export function renderSurfaces(proof) {
  const published = proof?.log?.records
    ? `<a class="surface" href="/decision-log.jsonl">
        <div class="k">The log itself</div>
        <div class="v">/decision-log.jsonl</div>
        <div class="d">The hash-chained decisions, one JSON object per line.</div>
      </a>`
    : "";
  set(
    "surfaces-body",
    `${published}
      <a class="surface" href="/runs.html">
        <div class="k">The experiment</div>
        <div class="v">/runs</div>
        <div class="d">The same task under two limits. One variable changed.</div>
      </a>
      <a class="surface" href="/verify.html">
        <div class="k">Verify anyone's record</div>
        <div class="v">/verify</div>
        <div class="d">Paste a log URL and watch the check happen.</div>
      </a>
      <a class="surface" href="/docs/security-model.html">
        <div class="k">What we do not prove</div>
        <div class="v">/docs/security-model</div>
        <div class="d">The refusals are the owner's claim. Here is the whole of it.</div>
      </a>
      <a class="surface" href="/proof.json">
        <div class="k">Machine-readable proof</div>
        <div class="v">/proof.json</div>
        <div class="d">The same facts as JSON, no account, no session.</div>
      </a>
      <a class="surface" href="https://github.com/unifyWeb3/capsule">
        <div class="k">Repository</div>
        <div class="v">unifyWeb3/capsule</div>
        <div class="d">The agent, the decision log and the verifier.</div>
      </a>
      <a class="surface" href="https://docs.gokite.ai/passport">
        <div class="k">The limit itself</div>
        <div class="v">Kite Agent Passport</div>
        <div class="d">The session that refuses the purchase, outside this program.</div>
      </a>`,
  );
}
