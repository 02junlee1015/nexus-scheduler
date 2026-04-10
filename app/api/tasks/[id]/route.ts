import { NextResponse } from "next/server";
import * as taskService from "@/lib/services/task-service";
import { patchTaskBody } from "@/lib/validations/api";
import { normalizePatchTask } from "@/lib/validations/normalize";
import { requireUser } from "@/lib/api/auth-utils";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const t = await taskService.getTaskForUser(id, auth.user.id);
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(t);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = patchTaskBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const norm = normalizePatchTask(parsed.data);
  if (!norm.ok) {
    return NextResponse.json({ error: norm.message }, { status: 400 });
  }
  try {
    const t = await taskService.updateTaskForUser(
      { id, ...norm.value },
      auth.user.id,
    );
    return NextResponse.json(t);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    await taskService.deleteTaskForUser(id, auth.user.id);
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
