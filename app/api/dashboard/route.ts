import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/services/dashboard-service";
import { requireUser } from "@/lib/api/auth-utils";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const data = await getDashboardData(auth.user.id);
  return NextResponse.json(data);
}
