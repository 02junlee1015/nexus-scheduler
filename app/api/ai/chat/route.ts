import { NextResponse } from "next/server";
import { z } from "zod";
import { runSchedulerAgent } from "@/lib/ai/run-agent";
import { requireUser } from "@/lib/api/auth-utils";

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().max(12_000, "Message too long"),
      }),
    )
    .min(1)
    .max(40, "Too many messages in one request"),
});

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await runSchedulerAgent(parsed.data.messages, {
      userId: auth.user.id,
    });
    return NextResponse.json({
      reply: result.reply,
      toolCallsApplied: result.toolCallsApplied,
      meta: result.meta,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI request failed";
    return NextResponse.json(
      {
        error: msg,
        meta: { configured: false, model: null, finishReason: "unexpected" },
      },
      { status: 502 },
    );
  }
}
