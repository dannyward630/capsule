/**
 * What the limit cost.
 *
 * The recorded run says which facts the answer did not cover. This says what
 * the evidence for them would have cost, taken from the attempts the agent
 * actually made: every refusal names the endpoint it wanted, the price it
 * would have cost, and the fact it was for. It turns "covered two of five
 * facts" into the number that matters — the limit cost this much.
 */
import type { LogRecord } from "./log.js";
import type { Menu } from "./menu.js";

export interface AttemptedFact {
  fact: string | null;
  /** The endpoint the agent wanted. */
  wanted: string;
  wanted_price_usd: string;
  /** "budget" when the total ran out, "session cap" when one call was too dear. */
  blocked_by: "budget" | "session cap";
  /** The Passport's own error code. */
  error_code: string;
}

export interface Counterfactual {
  /** The facts the answer needed, and whether the evidence for them was bought. */
  facts: Array<{
    fact: string;
    covered: boolean;
    /** The refused attempt that would have covered it, if there was one. */
    blocked_attempt: AttemptedFact | null;
  }>;
  /** Every refusal, priced. */
  attempts: AttemptedFact[];
  /** What the refusals would have cost together. */
  cost_usd: number;
  /** How many times over the session's total budget that cost was. */
  budget_multiplier: number | null;
  /** The session's total budget, for the arithmetic. */
  budget_usd: number;
  /** The facts the agent never got to try. */
  unattempted_facts: string[];
}

function blockedBy(errorCode: string): "budget" | "session cap" {
  return errorCode === "session_rule_exceeded" ? "session cap" : "budget";
}

export function computeCounterfactual(input: {
  records: LogRecord[];
  facts: string[];
  menu: Menu;
  budgetUsd: number;
}): Counterfactual {
  const attempts: AttemptedFact[] = [];
  const coveredFacts = new Set<string>();
  const attemptedFacts = new Set<string>();

  for (const record of input.records) {
    const decision = record.decision;
    if (decision.kind === "note") continue;
    if (decision.fact) attemptedFacts.add(decision.fact);
    if (decision.kind === "purchase") {
      if (decision.fact) coveredFacts.add(decision.fact);
      continue;
    }
    attempts.push({
      fact: decision.fact,
      wanted: `${decision.service} ${decision.url.split("?")[0]}`,
      wanted_price_usd: decision.price_usd,
      blocked_by: blockedBy(decision.error_code),
      error_code: decision.error_code,
    });
  }

  const cost = attempts.reduce(
    (total, attempt) => total + Number(attempt.wanted_price_usd),
    0,
  );

  const facts = input.facts.map((fact) => ({
    fact,
    covered: coveredFacts.has(fact),
    blocked_attempt: attempts.find((attempt) => attempt.fact === fact) ?? null,
  }));

  return {
    facts,
    attempts,
    cost_usd: Number(cost.toFixed(4)),
    budget_multiplier:
      input.budgetUsd > 0 ? Number((cost / input.budgetUsd).toFixed(2)) : null,
    budget_usd: input.budgetUsd,
    unattempted_facts: input.facts.filter(
      (fact) => !attemptedFacts.has(fact) && !coveredFacts.has(fact),
    ),
  };
}
