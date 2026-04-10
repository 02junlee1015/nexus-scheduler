import { NextResponse } from "next/server";
import * as eventService from "@/lib/services/event-service";
import { bulkEventsBody } from "@/lib/validations/api";
import { normalizeCreateEvent } from "@/lib/validations/normalize";
import { requireUser } from "@/lib/api/auth-utils";

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const json = await req.json().catch(() => null);
  const parsed = bulkEventsBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const inputs: Parameters<typeof eventService.importEvents>[0] = [];
  for (let i = 0; i < parsed.data.events.length; i++) {
    const norm = normalizeCreateEvent(parsed.data.events[i]!);
    if (!norm.ok) {
      return NextResponse.json(
        { error: norm.message, atIndex: i },
        { status: 400 },
      );
    }
    inputs.push(norm.value);
  }

  const result = await eventService.importEvents(inputs, auth.user.id);
  return NextResponse.json(result, { status: 201 });
}
