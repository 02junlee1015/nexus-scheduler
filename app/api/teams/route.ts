import { NextResponse } from "next/server";
import { z } from "zod";
import * as teamService from "@/lib/services/team-service";
import { requireUser } from "@/lib/api/auth-utils";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const items = await teamService.listTeamsForUser(auth.user.id);
  return NextResponse.json({ items });
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  memberUserIds: z.array(z.string().min(1)).min(1),
});

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const team = await teamService.createTeam(auth.user.id, parsed.data);
    return NextResponse.json(team, { status: 201 });
  } catch (e) {
    const code = e instanceof Error ? e.message : "ERROR";
    if (code === "NEED_ONE_TEAMMATE") {
      return NextResponse.json(
        { error: "Select at least one friend besides yourself." },
        { status: 400 },
      );
    }
    if (code === "INVALID_NAME") {
      return NextResponse.json({ error: "Team name is required." }, { status: 400 });
    }
    if (code === "NOT_FRIENDS") {
      return NextResponse.json(
        { error: "You can only add accepted friends to a team." },
        { status: 403 },
      );
    }
    return NextResponse.json({ error: code }, { status: 400 });
  }
}
