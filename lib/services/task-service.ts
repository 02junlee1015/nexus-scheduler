import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { clampWorkload } from "@/lib/constants/workload";
import { syncTaskToCalendar } from "@/lib/services/sync-service";
import type {
  CreateTaskInput,
  TaskDTO,
  TaskStatus,
  UpdateTaskInput,
} from "@/lib/types/api";

function toDTO(
  t: {
    id: string;
    title: string;
    detail: string;
    classification: string;
    expectedWorkload: number;
    dueDate: Date | null;
    status: string;
    source: string;
    createdAt: Date;
    updatedAt: Date;
    calendarEvent?: { id: string } | null;
  },
): TaskDTO {
  return {
    id: t.id,
    title: t.title,
    detail: t.detail,
    classification: t.classification ?? "",
    expectedWorkload: clampWorkload(t.expectedWorkload),
    dueDate: t.dueDate?.toISOString() ?? null,
    status: t.status as TaskDTO["status"],
    source: t.source as TaskDTO["source"],
    linkedEventId: t.calendarEvent?.id ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

const taskInclude = { calendarEvent: { select: { id: true } } } as const;

export type TaskListScope = "active" | "done" | "all";

function buildTaskListQuery(filter?: {
  userId?: string;
  status?: TaskStatus;
  scope?: TaskListScope;
  flexNoDeadline?: boolean;
  requireDueDate?: boolean;
  search?: string;
  sort?: "due" | "updated" | "created" | "workload";
}): {
  where: Prisma.TaskWhereInput;
  orderBy: Prisma.TaskOrderByWithRelationInput[];
} {
  const where: Prisma.TaskWhereInput = {};
  if (filter?.userId) {
    where.userId = filter.userId;
  }
  if (filter?.scope === "active") {
    where.status = { in: ["todo", "in_progress"] };
  } else if (filter?.scope === "done") {
    where.status = "done";
  } else if (filter?.status) {
    where.status = filter.status;
  }
  if (filter?.flexNoDeadline) {
    where.dueDate = null;
  }
  if (filter?.requireDueDate) {
    where.dueDate = { not: null };
  }
  if (filter?.search?.trim()) {
    const q = filter.search.trim();
    where.OR = [
      { title: { contains: q } },
      { detail: { contains: q } },
      { classification: { contains: q } },
    ];
  }

  const orderBy: Prisma.TaskOrderByWithRelationInput[] = [];
  switch (filter?.sort) {
    case "updated":
      orderBy.push({ updatedAt: "desc" });
      break;
    case "created":
      orderBy.push({ createdAt: "desc" });
      break;
    case "workload":
      orderBy.push({ expectedWorkload: "desc" });
      break;
    case "due":
    default:
      orderBy.push({ dueDate: "asc" });
      orderBy.push({ createdAt: "desc" });
  }

  return { where, orderBy };
}

export async function listTasksPaged(
  filter:
    | {
        userId: string;
        status?: TaskStatus;
        scope?: TaskListScope;
        flexNoDeadline?: boolean;
        requireDueDate?: boolean;
        search?: string;
        sort?: "due" | "updated" | "created" | "workload";
      }
    | undefined,
  limit: number,
  offset: number,
): Promise<{ items: TaskDTO[]; total: number }> {
  if (!filter?.userId) {
    return { items: [], total: 0 };
  }
  const { where, orderBy } = buildTaskListQuery(filter);
  const [rows, total] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy,
      skip: offset,
      take: limit,
      include: taskInclude,
    }),
    prisma.task.count({ where }),
  ]);
  return { items: rows.map(toDTO), total };
}

export async function importTasks(
  inputs: Omit<CreateTaskInput, "userId">[],
  ownerUserId: string,
): Promise<{
  created: TaskDTO[];
  errors: { index: number; message: string }[];
}> {
  const created: TaskDTO[] = [];
  const errors: { index: number; message: string }[] = [];
  for (let i = 0; i < inputs.length; i++) {
    try {
      created.push(
        await createTask({ ...inputs[i]!, userId: ownerUserId }),
      );
    } catch (e) {
      errors.push({
        index: i,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return { created, errors };
}

export async function getTask(id: string): Promise<TaskDTO | null> {
  const t = await prisma.task.findUnique({
    where: { id },
    include: taskInclude,
  });
  return t ? toDTO(t) : null;
}

export async function getTaskForUser(
  id: string,
  userId: string,
): Promise<TaskDTO | null> {
  const t = await prisma.task.findFirst({
    where: { id, userId },
    include: taskInclude,
  });
  return t ? toDTO(t) : null;
}

export async function createTask(input: CreateTaskInput): Promise<TaskDTO> {
  const data: Prisma.TaskCreateInput = {
    title: input.title.trim(),
    detail: (input.detail ?? "").trim(),
    classification: (input.classification ?? "").trim(),
    expectedWorkload: clampWorkload(input.expectedWorkload ?? 2),
    dueDate:
      input.dueDate != null && input.dueDate !== ""
        ? new Date(input.dueDate)
        : null,
    status: input.status ?? "todo",
    source: input.source ?? "manual",
    user: { connect: { id: input.userId } },
  };

  const t = await prisma.task.create({
    data,
    include: taskInclude,
  });
  await syncTaskToCalendar(t);
  const refreshed = await prisma.task.findUnique({
    where: { id: t.id },
    include: taskInclude,
  });
  return toDTO(refreshed!);
}

export async function updateTask(input: UpdateTaskInput): Promise<TaskDTO> {
  const { id, ...rest } = input;
  const data: Prisma.TaskUpdateInput = {};

  if (rest.title !== undefined) data.title = rest.title.trim();
  if (rest.detail !== undefined) data.detail = rest.detail.trim();
  if (rest.classification !== undefined)
    data.classification = rest.classification.trim();
  if (rest.expectedWorkload !== undefined)
    data.expectedWorkload = clampWorkload(rest.expectedWorkload);
  if (rest.dueDate !== undefined)
    data.dueDate =
      rest.dueDate === null || rest.dueDate === ""
        ? null
        : new Date(rest.dueDate as string);
  if (rest.status !== undefined) data.status = rest.status;
  if (rest.source !== undefined) data.source = rest.source;

  if (Object.keys(data).length === 0) {
    const existing = await prisma.task.findUnique({
      where: { id },
      include: taskInclude,
    });
    if (!existing) throw new Error("NOT_FOUND");
    return toDTO(existing);
  }

  const t = await prisma.task.update({
    where: { id },
    data,
    include: taskInclude,
  });
  await syncTaskToCalendar(t);
  const refreshed = await prisma.task.findUnique({
    where: { id: t.id },
    include: taskInclude,
  });
  return toDTO(refreshed!);
}

export async function updateTaskForUser(
  input: UpdateTaskInput,
  userId: string,
): Promise<TaskDTO> {
  const ok = await prisma.task.findFirst({
    where: { id: input.id, userId },
    select: { id: true },
  });
  if (!ok) throw new Error("NOT_FOUND");
  return updateTask(input);
}

export async function deleteTask(id: string): Promise<void> {
  await prisma.task.delete({ where: { id } });
}

export async function deleteTaskForUser(
  id: string,
  userId: string,
): Promise<void> {
  const r = await prisma.task.deleteMany({ where: { id, userId } });
  if (r.count === 0) throw new Error("NOT_FOUND");
}

export async function queryTasksForAI(
  params: {
    userId: string;
    status?: string;
    titleContains?: string;
    dueBefore?: string;
    dueAfter?: string;
    minWorkload?: number;
    limit?: number;
  },
): Promise<TaskDTO[]> {
  const parts: Prisma.TaskWhereInput[] = [{ userId: params.userId }];
  if (params.status) parts.push({ status: params.status });
  if (params.titleContains?.trim()) {
    parts.push({ title: { contains: params.titleContains.trim() } });
  }
  if (params.dueBefore) {
    parts.push({ dueDate: { lte: new Date(params.dueBefore) } });
  }
  if (params.dueAfter) {
    parts.push({ dueDate: { gte: new Date(params.dueAfter) } });
  }
  if (params.minWorkload != null) {
    parts.push({ expectedWorkload: { gte: params.minWorkload } });
  }

  const where: Prisma.TaskWhereInput = { AND: parts };

  const rows = await prisma.task.findMany({
    where,
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: params.limit ?? 50,
    include: taskInclude,
  });
  return rows.map(toDTO);
}
