import { NextResponse } from "next/server";
import { z } from "zod";
import * as friendshipService from "@/lib/services/friendship-service";
import { requireUser } from "@/lib/api/auth-utils";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const data = await friendshipService.listFriendships(auth.user.id);
  return NextResponse.json(data);
}

const requestSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const json = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const row = await friendshipService.sendFriendRequest(
      auth.user.id,
      parsed.data.email,
    );
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    const code = e instanceof Error ? e.message : "ERROR";
    const map: Record<string, { status: number; error: string }> = {
      INVALID_EMAIL: { status: 400, error: "Invalid email" },
      USER_NOT_FOUND: {
        status: 404,
        error:
          "No member uses that sign-up email. They need an account before you can connect.",
      },
      SELF: { status: 400, error: "You cannot add yourself" },
      ALREADY_FRIENDS: { status: 409, error: "Already friends" },
      ALREADY_SENT: { status: 409, error: "Request already sent" },
      INCOMING_PENDING: {
        status: 409,
        error: "They already sent you a request — accept it from incoming",
      },
    };
    const m = map[code] ?? { status: 400, error: code };
    return NextResponse.json({ error: m.error }, { status: m.status });
  }
}
