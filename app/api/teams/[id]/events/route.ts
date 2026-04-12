import { NextResponse } from "next/server";
import * as teamService from "@/lib/services/team-service";
import { requireUser } from "@/lib/api/auth-utils";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json(
      { error: "start and end query params required (ISO dates)" },
      { status: 400 },
    );
  }
  const range = { start: new Date(start), end: new Date(end) };
  try {
    const items = await teamService.listTeamEvents(id, auth.user.id, range);
    return NextResponse.json({ items });
  } catch (e) {
    const code = e instanceof Error ? e.message : "ERROR";
    if (code === "NOT_MEMBER")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: code }, { status: 400 });
  }
}
