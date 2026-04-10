import { NextResponse } from "next/server";
import { DEFAULT_MODEL, getPublicAIStatus } from "@/lib/ai/config";

/** Public readiness check for the chat widget (no secrets). */
export async function GET() {
  const s = getPublicAIStatus();
  return NextResponse.json({
    ready: s.ready,
    model: s.model,
    defaultModel: DEFAULT_MODEL,
    reason: s.reason,
  });
}
