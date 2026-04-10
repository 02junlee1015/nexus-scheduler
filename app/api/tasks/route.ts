import { NextResponse } from "next/server";
import * as taskService from "@/lib/services/task-service";
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
} from "@/lib/constants/api-limits";
import { createTaskBody } from "@/lib/validations/api";
import { normalizeCreateTask } from "@/lib/validations/normalize";
import { requireUser } from "@/lib/api/auth-utils";

function parseLimitOffset(url: URL) {
  let limit = Number(url.searchParams.get("limit") ?? DEFAULT_LIST_LIMIT);
  let offset = Number(url.searchParams.get("offset") ?? 0);
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIST_LIMIT;
  if (limit > MAX_LIST_LIMIT) limit = MAX_LIST_LIMIT;
  if (!Number.isFinite(offset) || offset < 0) offset = 0;
  return { limit, offset };
}

export async function GET(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as
    | "todo"
    | "in_progress"
    | "done"
    | null;
  const scopeRaw = searchParams.get("scope");
  const scope =
    scopeRaw === "active" || scopeRaw === "done" ? scopeRaw : undefined;
  const flexNoDeadline = searchParams.get("flex") === "1";
  const requireDueDate = searchParams.get("hasDue") === "1";
  const search = searchParams.get("q") ?? undefined;
  let sort = (searchParams.get("sort") as
    | "due"
    | "updated"
    | "created"
    | "workload"
    | null) ?? "due";
  if (scope === "done" && !searchParams.get("sort")) {
    sort = "updated";
  }
  if (flexNoDeadline && !searchParams.get("sort")) {
    sort = "updated";
  }

  const { limit, offset } = parseLimitOffset(new URL(req.url));

  const { items, total } = await taskService.listTasksPaged(
    {
      userId: auth.user.id,
      status: status ?? undefined,
      scope,
      flexNoDeadline: flexNoDeadline || undefined,
      requireDueDate: requireDueDate || undefined,
      search,
      sort,
    },
    limit,
    offset,
  );

  return NextResponse.json({ items, total, limit, offset });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const json = await req.json().catch(() => null);
  const parsed = createTaskBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const norm = normalizeCreateTask(parsed.data);
  if (!norm.ok) {
    return NextResponse.json({ error: norm.message }, { status: 400 });
  }
  const task = await taskService.createTask({
    ...norm.value,
    userId: auth.user.id,
  });
  return NextResponse.json(task, { status: 201 });
}
