import { NextResponse } from "next/server";
import * as taskService from "@/lib/services/task-service";
import { bulkTasksBody } from "@/lib/validations/api";
import { normalizeCreateTask } from "@/lib/validations/normalize";
import { requireUser } from "@/lib/api/auth-utils";

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const json = await req.json().catch(() => null);
  const parsed = bulkTasksBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const inputs: Parameters<typeof taskService.importTasks>[0] = [];
  for (let i = 0; i < parsed.data.tasks.length; i++) {
    const norm = normalizeCreateTask(parsed.data.tasks[i]!);
    if (!norm.ok) {
      return NextResponse.json(
        { error: norm.message, atIndex: i },
        { status: 400 },
      );
    }
    inputs.push(norm.value);
  }

  const result = await taskService.importTasks(inputs, auth.user.id);
  return NextResponse.json(result, { status: 201 });
}
