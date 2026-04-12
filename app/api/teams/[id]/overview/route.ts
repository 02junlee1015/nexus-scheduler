import { NextResponse } from "next/server";
import * as teamService from "@/lib/services/team-service";
import { requireUser } from "@/lib/api/auth-utils";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const data = await teamService.getTeamOverview(id, auth.user.id);
    return NextResponse.json(data);
  } catch (e) {
    const code = e instanceof Error ? e.message : "ERROR";
    if (code === "NOT_FOUND")
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (code === "NOT_MEMBER")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: code }, { status: 400 });
  }
}
