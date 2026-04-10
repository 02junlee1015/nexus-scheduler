import { NextResponse } from "next/server";
import * as notificationService from "@/lib/services/notification-service";
import { requireUser } from "@/lib/api/auth-utils";

export async function GET(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "1";
  const data = await notificationService.listNotifications(auth.user.id, {
    unreadOnly,
    limit: 100,
  });
  return NextResponse.json(data);
}
