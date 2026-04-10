import { NextResponse } from "next/server";
import * as notificationService from "@/lib/services/notification-service";
import { requireUser } from "@/lib/api/auth-utils";

export async function POST() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  await notificationService.markAllRead(auth.user.id);
  return NextResponse.json({ ok: true });
}
