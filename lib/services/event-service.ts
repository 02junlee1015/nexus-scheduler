import { addHours } from "date-fns";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  DEFAULT_LIST_LIMIT,
  MAX_EVENTS_IN_RANGE,
} from "@/lib/constants/api-limits";
import { clampWorkload, defaultEventDurationHours } from "@/lib/constants/workload";
import {
  attachMirrorTaskForEvent,
  syncLinkedTaskFromEvent,
  syncTaskToCalendar,
} from "@/lib/services/sync-service";
import type {
  CalendarEventDTO,
  CreateEventInput,
  UpdateEventInput,
} from "@/lib/types/api";

function toDTO(e: {
  id: string;
  title: string;
  detail: string;
  expectedWorkload: number;
  startDateTime: Date;
  endDateTime: Date;
  linkedTaskId: string | null;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}): CalendarEventDTO {
  return {
    id: e.id,
    title: e.title,
    detail: e.detail,
    expectedWorkload: clampWorkload(e.expectedWorkload),
    startDateTime: e.startDateTime.toISOString(),
    endDateTime: e.endDateTime.toISOString(),
    linkedTaskId: e.linkedTaskId,
    source: e.source as CalendarEventDTO["source"],
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

export async function listEvents(
  userId: string,
  range?: { start: Date; end: Date },
  pagination?: { limit: number; offset: number },
): Promise<{ items: CalendarEventDTO[]; total: number }> {
  const where: Prisma.CalendarEventWhereInput = { userId };
  if (range) {
    where.AND = [
      { startDateTime: { lt: range.end } },
      { endDateTime: { gt: range.start } },
    ];
  }

  const limit =
    pagination?.limit ??
    (range ? MAX_EVENTS_IN_RANGE : DEFAULT_LIST_LIMIT);
  const offset = pagination?.offset ?? 0;

  const [rows, total] = await Promise.all([
    prisma.calendarEvent.findMany({
      where,
      orderBy: { startDateTime: "asc" },
      skip: offset,
      take: limit,
    }),
    prisma.calendarEvent.count({ where }),
  ]);
  return { items: rows.map(toDTO), total };
}

export async function importEvents(
  inputs: Omit<CreateEventInput, "userId">[],
  ownerUserId: string,
): Promise<{
  created: CalendarEventDTO[];
  errors: { index: number; message: string }[];
}> {
  const created: CalendarEventDTO[] = [];
  const errors: { index: number; message: string }[] = [];
  for (let i = 0; i < inputs.length; i++) {
    try {
      created.push(
        await createEvent({ ...inputs[i]!, userId: ownerUserId }),
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

export async function getEvent(id: string): Promise<CalendarEventDTO | null> {
  const e = await prisma.calendarEvent.findUnique({ where: { id } });
  return e ? toDTO(e) : null;
}

export async function getEventForUser(
  id: string,
  userId: string,
): Promise<CalendarEventDTO | null> {
  const e = await prisma.calendarEvent.findFirst({ where: { id, userId } });
  return e ? toDTO(e) : null;
}

export async function createEvent(
  input: CreateEventInput,
): Promise<CalendarEventDTO> {
  const wl = clampWorkload(input.expectedWorkload ?? 2);
  const start = new Date(input.startDateTime);
  const end = input.endDateTime
    ? new Date(input.endDateTime)
    : addHours(start, defaultEventDurationHours(wl));

  let created = await prisma.calendarEvent.create({
    data: {
      userId: input.userId,
      title: input.title.trim(),
      detail: (input.detail ?? "").trim(),
      expectedWorkload: wl,
      startDateTime: start,
      endDateTime: end,
      source: input.source ?? "manual",
    },
  });

  if (!input.skipMirrorTask) {
    await attachMirrorTaskForEvent(created);
    created = await prisma.calendarEvent.findUniqueOrThrow({
      where: { id: created.id },
    });
    const task = await prisma.task.findUniqueOrThrow({
      where: { id: created.linkedTaskId! },
    });
    await syncTaskToCalendar(task);
  }

  return toDTO(created);
}

export async function updateEvent(input: UpdateEventInput): Promise<CalendarEventDTO> {
  const { id, ...rest } = input;
  const existing = await prisma.calendarEvent.findUnique({ where: { id } });
  if (!existing) throw new Error("NOT_FOUND");

  const data: Prisma.CalendarEventUpdateInput = {};

  if (rest.title !== undefined) data.title = rest.title.trim();
  if (rest.detail !== undefined) data.detail = rest.detail.trim();
  if (rest.expectedWorkload !== undefined)
    data.expectedWorkload = clampWorkload(rest.expectedWorkload);
  if (rest.startDateTime !== undefined)
    data.startDateTime = new Date(rest.startDateTime);
  if (rest.source !== undefined) data.source = rest.source;

  if (rest.endDateTime !== undefined) {
    if (rest.endDateTime === null) {
      const nextStart = rest.startDateTime
        ? new Date(rest.startDateTime)
        : existing.startDateTime;
      const wl =
        rest.expectedWorkload !== undefined
          ? clampWorkload(rest.expectedWorkload)
          : existing.expectedWorkload;
      data.endDateTime = addHours(
        nextStart,
        defaultEventDurationHours(clampWorkload(wl)),
      );
    } else {
      data.endDateTime = new Date(rest.endDateTime);
    }
  }

  if (Object.keys(data).length === 0) {
    return toDTO(existing);
  }

  let e = await prisma.calendarEvent.update({
    where: { id },
    data,
  });

  if (e.linkedTaskId) {
    await syncLinkedTaskFromEvent(e);
    const task = await prisma.task.findUniqueOrThrow({
      where: { id: e.linkedTaskId },
    });
    await syncTaskToCalendar(task);
    e = await prisma.calendarEvent.findUniqueOrThrow({ where: { id } });
  }

  return toDTO(e);
}

export async function updateEventForUser(
  input: UpdateEventInput,
  userId: string,
): Promise<CalendarEventDTO> {
  const ok = await prisma.calendarEvent.findFirst({
    where: { id: input.id, userId },
    select: { id: true },
  });
  if (!ok) throw new Error("NOT_FOUND");
  return updateEvent(input);
}

export async function deleteEvent(id: string): Promise<void> {
  const e = await prisma.calendarEvent.findUnique({ where: { id } });
  if (!e) return;

  if (e.linkedTaskId) {
    await prisma.task.update({
      where: { id: e.linkedTaskId },
      data: { dueDate: null },
    });
  }

  await prisma.calendarEvent.delete({ where: { id } });
}

export async function deleteEventForUser(
  id: string,
  userId: string,
): Promise<void> {
  const e = await prisma.calendarEvent.findFirst({ where: { id, userId } });
  if (!e) throw new Error("NOT_FOUND");
  if (e.linkedTaskId) {
    await prisma.task.update({
      where: { id: e.linkedTaskId },
      data: { dueDate: null },
    });
  }
  await prisma.calendarEvent.delete({ where: { id } });
}

export async function queryEventsForAI(params: {
  userId: string;
  startAfter?: string;
  startBefore?: string;
  titleContains?: string;
  limit?: number;
}): Promise<CalendarEventDTO[]> {
  const parts: Prisma.CalendarEventWhereInput[] = [{ userId: params.userId }];
  if (params.startAfter) {
    parts.push({ startDateTime: { gte: new Date(params.startAfter) } });
  }
  if (params.startBefore) {
    parts.push({ startDateTime: { lte: new Date(params.startBefore) } });
  }
  if (params.titleContains?.trim()) {
    parts.push({ title: { contains: params.titleContains.trim() } });
  }

  const where: Prisma.CalendarEventWhereInput = { AND: parts };

  const rows = await prisma.calendarEvent.findMany({
    where,
    orderBy: { startDateTime: "asc" },
    take: params.limit ?? 50,
  });
  return rows.map(toDTO);
}
