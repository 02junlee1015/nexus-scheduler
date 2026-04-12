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
    const team = await teamService.getTeamSummary(id, auth.user.id);
    if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(team);
  } catch (e) {
    const code = e instanceof Error ? e.message : "ERROR";
    if (code === "NOT_MEMBER")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: code }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    await teamService.deleteTeam(id, auth.user.id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    const code = e instanceof Error ? e.message : "ERROR";
    if (code === "NOT_FOUND")
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (code === "FORBIDDEN")
      return NextResponse.json({ error: "Only the team owner can delete" }, { status: 403 });
    return NextResponse.json({ error: code }, { status: 400 });
  }
}
