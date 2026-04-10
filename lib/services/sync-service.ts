import { addHours } from "date-fns";
import type { Task, CalendarEvent } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  clampWorkload,
  defaultEventDurationHours,
  type WorkloadLevel,
} from "@/lib/constants/workload";

/** New calendar block from task-only deadline: anchor at 09:00 UTC on that calendar day */
function defaultStartForDueDate(due: Date): Date {
  const d = new Date(due);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 9, 0, 0, 0),
  );
}

/** Apply task's due calendar day to an existing event while preserving its clock time (UTC components) */
function mergeDueDateIntoEventStart(due: Date, previousStart: Date): Date {
  const next = new Date(previousStart);
  next.setUTCFullYear(due.getUTCFullYear());
  next.setUTCMonth(due.getUTCMonth());
  next.setUTCDate(due.getUTCDate());
  return next;
}

export async function syncTaskToCalendar(task: Task): Promise<void> {
  const existing = await prisma.calendarEvent.findFirst({
    where: { linkedTaskId: task.id },
  });

  const shouldHaveBlock =
    task.dueDate != null && task.status !== "done" && task.status !== "Done";

  if (!shouldHaveBlock) {
    if (existing) {
      await prisma.calendarEvent.delete({ where: { id: existing.id } });
    }
    return;
  }

  const due = task.dueDate!;
  const wl = clampWorkload(task.expectedWorkload) as WorkloadLevel;
  const duration = defaultEventDurationHours(wl);

  const basePayload = {
    title: task.title,
    detail: task.detail,
    expectedWorkload: wl,
    source: "todo" as const,
  };

  if (existing) {
    const start = mergeDueDateIntoEventStart(due, existing.startDateTime);
    const end = addHours(start, duration);
    await prisma.calendarEvent.update({
      where: { id: existing.id },
      data: {
        ...basePayload,
        startDateTime: start,
        endDateTime: end,
      },
    });
  } else {
    const start = defaultStartForDueDate(due);
    const end = addHours(start, duration);
    await prisma.calendarEvent.create({
      data: {
        ...basePayload,
        userId: task.userId,
        startDateTime: start,
        endDateTime: end,
        linkedTaskId: task.id,
      },
    });
  }
}

export async function attachMirrorTaskForEvent(
  event: CalendarEvent,
): Promise<Task> {
  if (event.linkedTaskId) {
    return prisma.task.findUniqueOrThrow({ where: { id: event.linkedTaskId } });
  }

  const d = new Date(event.startDateTime);
  const dueDayUtc = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const task = await prisma.task.create({
    data: {
      userId: event.userId,
      title: event.title,
      detail: event.detail,
      expectedWorkload: clampWorkload(event.expectedWorkload),
      dueDate: dueDayUtc,
      status: "todo",
      source: "calendar",
    },
  });

  await prisma.calendarEvent.update({
    where: { id: event.id },
    data: { linkedTaskId: task.id },
  });

  return task;
}

export async function syncLinkedTaskFromEvent(
  event: CalendarEvent,
): Promise<void> {
  if (!event.linkedTaskId) return;

  const d = new Date(event.startDateTime);
  const dueDayUtc = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  await prisma.task.update({
    where: { id: event.linkedTaskId },
    data: {
      title: event.title,
      detail: event.detail,
      expectedWorkload: clampWorkload(event.expectedWorkload),
      dueDate: dueDayUtc,
    },
  });
}

export async function syncTaskAndCalendar(taskId: string): Promise<void> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return;
  await syncTaskToCalendar(task);
}
