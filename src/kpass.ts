/**
 * A thin, typed wrapper over the `kpass` CLI.
 *
 * The CLI is the only supported way to talk to the Passport, and it is the
 * component that holds the agent's key. Everything it returns is recorded
 * verbatim, because the receipt has to survive to the proof page unchanged.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export interface KpassOptions {
  /** Project directory holding .kite-passport/ state. Defaults to the cwd. */
  cwd?: string;
  /** The session to pay from. Defaults to the CLI's current session. */
  sessionId?: string | null;
  timeoutMs?: number;
}

export interface KpassSuccess {
  ok: true;
  session_id: string | null;
  session_status: string | null;
  delegation: {
    task?: { summary?: string };
    payment_policy?: {
      max_amount_per_tx?: string;
      max_total_amount?: string;
      assets?: string[];
    };
  } | null;
  usage: { spent_total?: string; reserved_total?: string } | null;
  payment_requirement: { asset?: string; amount?: string } | null;
  x402: {
    status_code?: number;
    response_body?: string;
    parsed_response_body?: unknown;
    wallet_address?: string;
    chain_id?: number;
  } | null;
  raw: unknown;
}

export interface KpassFailure {
  ok: false;
  error_code: string | null;
  error: string | null;
  hint: string | null;
  exit_code: number;
  /** The session spending limits that were in force when this failed. */
  delegation: KpassSuccess["delegation"];
  usage: KpassSuccess["usage"];
  raw: unknown;
}

export type KpassResult = KpassSuccess | KpassFailure;

/** The refusals that make the demo. Everything else is a bug to investigate. */
export const CAP_REFUSALS = new Set([
  "session_rule_exceeded",
  "session_total_exceeded",
  "session_endpoint_forbidden",
  "session_asset_forbidden",
  "separate_session_used_up",
]);

export function isCapRefusal(result: KpassResult): boolean {
  return !result.ok && CAP_REFUSALS.has(result.error_code ?? "");
}

export class Kpass {
  constructor(private readonly options: KpassOptions = {}) {}

  private async run(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
    try {
      const { stdout, stderr } = await exec("kpass", args, {
        cwd: this.options.cwd,
        timeout: this.options.timeoutMs ?? 120_000,
        maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env },
      });
      return { code: 0, stdout, stderr };
    } catch (error) {
      const failure = error as { code?: number; stdout?: string; stderr?: string };
      return {
        code: typeof failure.code === "number" ? failure.code : 1,
        stdout: failure.stdout ?? "",
        stderr: failure.stderr ?? String(error),
      };
    }
  }

  /** Executes one paid call. Never throws for a refused payment. */
  async pay(url: string, idempotencyKey: string, method = "GET"): Promise<KpassResult> {
    const args = [
      "session",
      "execute",
      "--url",
      url,
      "--method",
      method,
      "--idempotency-key",
      idempotencyKey,
      "--output",
      "json",
    ];
    if (this.options.sessionId) {
      args.push("--session-id", this.options.sessionId);
    }
    const { code, stdout, stderr } = await this.run(args);
    const parsed = parseJson(stdout) ?? parseJson(stderr);
    if (code === 0 && parsed && (parsed as { status?: string }).status === "success") {
      return { ok: true, ...(parsed as Omit<KpassSuccess, "ok" | "raw">), raw: parsed };
    }
    const failure = (parsed ?? {}) as Record<string, unknown>;
    return {
      ok: false,
      error_code: typeof failure.error_code === "string" ? failure.error_code : null,
      error: typeof failure.error === "string" ? failure.error : stderr.slice(0, 500),
      hint: typeof failure.hint === "string" ? failure.hint : null,
      exit_code: code,
      delegation: (failure.delegation as KpassSuccess["delegation"]) ?? null,
      usage: (failure.usage as KpassSuccess["usage"]) ?? null,
      raw: parsed ?? { stderr },
    };
  }

  /** Reads the session's own view of its limits and spend. */
  async sessionStatus(requestId: string): Promise<unknown> {
    const { stdout } = await this.run([
      "session",
      "status",
      "--request-id",
      requestId,
      "--output",
      "json",
    ]);
    return parseJson(stdout);
  }
}

function parseJson(text: string): unknown {
  if (!text) return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
