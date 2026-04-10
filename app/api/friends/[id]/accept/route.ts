import { NextResponse } from "next/server";
import * as friendshipService from "@/lib/services/friendship-service";
import { requireUser } from "@/lib/api/auth-utils";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const row = await friendshipService.acceptFriendship(id, auth.user.id);
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
