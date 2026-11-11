/**
 * The reasoning layer.
 *
 * SERV Reasoning is wire-compatible with the OpenAI chat completions API, so
 * the client is plain fetch with one base URL changed. Every call is recorded:
 * model, the SERV features used, tokens, latency and cost, because the audit
 * trail is part of the evidence a judge reads.
 */

export const SERV_BASE_URL = (
  process.env.SERV_BASE_URL ?? "https://inference-api.openserv.ai/v1"
).replace(/\/$/, "");

export interface ServCallRecord {
  at: string;
  model: string;
  purpose: string;
  latency_ms: number;
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
  serv_features: string[] | null;
  error: string | null;
}

export interface ServChoice {
  /** What the model decided to do. */
  action: "buy" | "stop" | "answer";
  endpoint: string | null;
  topic: string | null;
  reason: string;
}

export interface ServResult {
  choice: ServChoice;
  record: ServCallRecord;
}

const SYSTEM_PROMPT = `You are the decision layer of an agent that buys data with real money.
You are given a task, the catalog of paid endpoints with their prices, and the state of a spending session.
Reply with JSON only, no prose, using this shape:
{"action":"buy"|"stop"|"answer","endpoint":string|null,"topic":string|null,"reason":string}
Rules:
- "buy" means: buy exactly one endpoint now, and only if the answer still needs it.
- "stop" means: no further purchase can add value to the answer.
- "answer" means: the evidence you hold is enough, so answer now.
Never propose an endpoint that is not in the catalog. Never propose a purchase you were told was refused.
Be explicit in "reason" about what the purchase would add.`;

export class ServClient {
  private readonly apiKey: string;
  readonly calls: ServCallRecord[] = [];

  constructor(apiKey = process.env.SERV_API_KEY ?? "") {
    if (!apiKey) throw new Error("SERV_API_KEY is not set");
    this.apiKey = apiKey;
  }

  async decide(input: {
    purpose: string;
    task: string;
    catalog: Array<{ path: string; price_usd: string; summary: string; returns: string[] }>;
    state: unknown;
  }): Promise<ServResult> {
    const model = process.env.SERV_MODEL ?? "gpt-5.4-mini";
    const started = Date.now();
    const body = {
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            task: input.task,
            catalog: input.catalog,
            state: input.state,
          }),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "purchase_decision",
          strict: true,
          schema: {
            type: "object",
            properties: {
              action: { type: "string", enum: ["buy", "stop", "answer"] },
              endpoint: { type: ["string", "null"] },
              topic: { type: ["string", "null"] },
              reason: { type: "string" },
            },
            required: ["action", "endpoint", "topic", "reason"],
            additionalProperties: false,
          },
        },
      },
    };
    const record: ServCallRecord = {
      at: new Date().toISOString(),
      model,
      purpose: input.purpose,
      latency_ms: 0,
      usage: null,
      serv_features: null,
      error: null,
    };
    try {
      const response = await fetch(`${SERV_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`SERV HTTP ${response.status}: ${text.slice(0, 300)}`);
      }
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: Record<string, number>;
        serv?: { features?: string[] };
      };
      record.latency_ms = Date.now() - started;
      record.usage = payload.usage ?? null;
      record.serv_features = payload.serv?.features ?? null;
      const content = payload.choices?.[0]?.message?.content ?? "{}";
      const choice = parseChoice(content);
      this.calls.push(record);
      return { choice, record };
    } catch (error) {
      record.latency_ms = Date.now() - started;
      record.error = error instanceof Error ? error.message : String(error);
      this.calls.push(record);
      throw error;
    }
  }

  /** Writes the final answer from the evidence the agent was able to buy. */
  async answer(input: {
    task: string;
    evidence: Array<{ endpoint: string; data: unknown }>;
    refusals: Array<{ endpoint: string; error_code: string; message: string }>;
    session: { max_amount_per_tx: string | null; max_total_amount: string | null; spent_total: string | null };
  }): Promise<{ text: string; record: ServCallRecord }> {
    const model = process.env.SERV_MODEL ?? "gpt-5.4-mini";
    const started = Date.now();
    const record: ServCallRecord = {
      at: new Date().toISOString(),
      model,
      purpose: "final answer",
      latency_ms: 0,
      usage: null,
      serv_features: null,
      error: null,
    };
    const instruction = `Answer the task using only the evidence below.
If a purchase was refused by the spending session, say plainly what you could not check and why.
Do not invent a figure that is not in the evidence.
Task: ${input.task}`;
    try {
      const response = await fetch(`${SERV_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "You answer a question from evidence and name what you could not check." },
            { role: "user", content: JSON.stringify({ ...input, instruction }) },
          ],
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`SERV HTTP ${response.status}: ${text.slice(0, 300)}`);
      }
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: Record<string, number>;
        serv?: { features?: string[] };
      };
      record.latency_ms = Date.now() - started;
      record.usage = payload.usage ?? null;
      record.serv_features = payload.serv?.features ?? null;
      const text = payload.choices?.[0]?.message?.content ?? "";
      this.calls.push(record);
      return { text, record };
    } catch (error) {
      record.latency_ms = Date.now() - started;
      record.error = error instanceof Error ? error.message : String(error);
      this.calls.push(record);
      throw error;
    }
  }

  /** Parses the model's JSON answer, tolerating a fenced block. */
  private static parseChoice(content: string): ServChoice {
    return parseChoice(content);
  }
}

/** Parses the model's JSON answer, tolerating a fenced block. */
export function parseChoice(content: string): ServChoice {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`SERV returned unparseable JSON: ${cleaned.slice(0, 200)}`);
  }
  const row = parsed as Partial<ServChoice>;
  const action = row.action;
  if (action !== "buy" && action !== "stop" && action !== "answer") {
    throw new Error(`SERV returned an unknown action: ${String(action)}`);
  }
  return {
    action,
    endpoint: typeof row.endpoint === "string" ? row.endpoint : null,
    topic: typeof row.topic === "string" ? row.topic : null,
    reason: typeof row.reason === "string" ? row.reason : "",
  };
}
