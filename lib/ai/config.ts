/**
 * OpenAI integration — single place for env validation and client defaults.
 */

export const DEFAULT_MODEL = "gpt-4o-mini";
export const MAX_AGENT_STEPS = 10;
export const OPENAI_TIMEOUT_MS = 90_000;
export const MAX_TOOL_RESULT_CHARS = 14_000;

export type AIEnvStatus =
  | { ready: true; apiKey: string; model: string }
  | { ready: false; reason: "missing_key" | "invalid_key_format" };

export function getAIEnvStatus(): AIEnvStatus {
  const raw = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (!raw) {
    return { ready: false, reason: "missing_key" };
  }
  if (!raw.startsWith("sk-")) {
    return { ready: false, reason: "invalid_key_format" };
  }
  const model = (process.env.OPENAI_MODEL ?? DEFAULT_MODEL).trim();
  return { ready: true, apiKey: raw, model };
}

export function getPublicAIStatus(): {
  ready: boolean;
  model: string | null;
  reason: "missing_key" | "invalid_key_format" | null;
} {
  const s = getAIEnvStatus();
  if (s.ready) {
    return { ready: true, model: s.model, reason: null };
  }
  return {
    ready: false,
    model: null,
    reason: s.reason,
  };
}
