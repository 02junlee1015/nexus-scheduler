import { NextResponse } from "next/server";
import * as eventService from "@/lib/services/event-service";
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_EVENTS_IN_RANGE,
} from "@/lib/constants/api-limits";
import { createEventBody } from "@/lib/validations/api";
import { normalizeCreateEvent } from "@/lib/validations/normalize";
import { requireUser } from "@/lib/api/auth-utils";

function parseLimitOffset(url: URL, inRange: boolean) {
  const cap = inRange ? MAX_EVENTS_IN_RANGE : MAX_LIST_LIMIT;
  const def = inRange ? MAX_EVENTS_IN_RANGE : DEFAULT_LIST_LIMIT;
  let limit = Number(url.searchParams.get("limit") ?? def);
  let offset = Number(url.searchParams.get("offset") ?? 0);
  if (!Number.isFinite(limit) || limit < 1) limit = def;
  if (limit > cap) limit = cap;
  if (!Number.isFinite(offset) || offset < 0) offset = 0;
  return { limit, offset };
}

export async function GET(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const range =
    start && end
      ? { start: new Date(start), end: new Date(end) }
      : undefined;

  const { limit, offset } = parseLimitOffset(new URL(req.url), Boolean(range));

  const { items, total } = await eventService.listEvents(
    auth.user.id,
    range,
    {
      limit,
      offset,
    },
  );
  return NextResponse.json({ items, total, limit, offset });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const json = await req.json().catch(() => null);
  const parsed = createEventBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const norm = normalizeCreateEvent(parsed.data);
  if (!norm.ok) {
    return NextResponse.json({ error: norm.message }, { status: 400 });
  }
  const ev = await eventService.createEvent({
    ...norm.value,
    userId: auth.user.id,
  });
  return NextResponse.json(ev, { status: 201 });
}
