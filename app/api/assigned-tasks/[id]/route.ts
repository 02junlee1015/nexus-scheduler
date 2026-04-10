import { NextResponse } from "next/server";
import { z } from "zod";
import * as assignmentService from "@/lib/services/assignment-service";
import { requireUser } from "@/lib/api/auth-utils";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const row = await assignmentService.getAssignment(id, auth.user.id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

const reviseSchema = z.object({
  title: z.string().min(1).max(500),
  detail: z.string().max(8000).optional(),
  deadline: z.union([z.string(), z.null()]).optional(),
  expectedWorkload: z.coerce.number().int().min(1).max(3).optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = reviseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const row = await assignmentService.reviseAssignment(id, auth.user.id, {
      title: parsed.data.title,
      detail: parsed.data.detail,
      deadline: parsed.data.deadline,
      expectedWorkload: parsed.data.expectedWorkload,
    });
    return NextResponse.json(row);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (msg === "NOT_FOUND")
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (msg === "FORBIDDEN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
