import { NextResponse } from "next/server";
import * as eventService from "@/lib/services/event-service";
import { patchEventBody } from "@/lib/validations/api";
import { normalizePatchEvent } from "@/lib/validations/normalize";
import { requireUser } from "@/lib/api/auth-utils";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const e = await eventService.getEventForUser(id, auth.user.id);
  if (!e) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(e);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = patchEventBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const norm = normalizePatchEvent(parsed.data);
  if (!norm.ok) {
    return NextResponse.json({ error: norm.message }, { status: 400 });
  }
  try {
    const e = await eventService.updateEventForUser(
      { id, ...norm.value },
      auth.user.id,
    );
    return NextResponse.json(e);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    await eventService.deleteEventForUser(id, auth.user.id);
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
