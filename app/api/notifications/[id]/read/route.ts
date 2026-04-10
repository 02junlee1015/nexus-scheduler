import { NextResponse } from "next/server";
import * as notificationService from "@/lib/services/notification-service";
import { requireUser } from "@/lib/api/auth-utils";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  await notificationService.markNotificationRead(id, auth.user.id);
  return NextResponse.json({ ok: true });
}
