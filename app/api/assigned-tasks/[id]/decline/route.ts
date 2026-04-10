import { NextResponse } from "next/server";
import * as assignmentService from "@/lib/services/assignment-service";
import { requireUser } from "@/lib/api/auth-utils";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    await assignmentService.declineAssignment(id, auth.user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (msg === "NOT_FOUND")
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (msg === "FORBIDDEN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
