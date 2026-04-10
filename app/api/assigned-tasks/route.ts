import { NextResponse } from "next/server";
import { z } from "zod";
import * as assignmentService from "@/lib/services/assignment-service";
import { requireUser } from "@/lib/api/auth-utils";

export async function GET(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role");
  const scope =
    role === "sent" || role === "received" ? role : "all";
  const items = await assignmentService.listAssignmentsForUser(
    auth.user.id,
    scope,
  );
  return NextResponse.json({ items });
}

const createSchema = z.object({
  recipientUserId: z.string().min(1),
  title: z.string().min(1).max(500),
  detail: z.string().max(8000).optional(),
  deadline: z.union([z.string(), z.null()]).optional(),
  expectedWorkload: z.coerce.number().int().min(1).max(3).optional(),
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
    const row = await assignmentService.createAssignment(auth.user.id, {
      recipientUserId: parsed.data.recipientUserId,
      title: parsed.data.title,
      detail: parsed.data.detail,
      deadline: parsed.data.deadline,
      expectedWorkload: parsed.data.expectedWorkload,
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (msg === "NOT_FRIENDS") {
      return NextResponse.json(
        { error: "You can only assign tasks to accepted friends" },
        { status: 403 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
