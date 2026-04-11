import { addHours } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import type { Task, CalendarEvent } from "@prisma/client";
import { prisma } from "@/lib/db";
import { APP_TIME_ZONE } from "@/lib/constants/timezone";
import {
  clampWorkload,
  defaultEventDurationHours,
  type WorkloadLevel,
} from "@/lib/constants/workload";

const TZ = APP_TIME_ZONE;

const seoulDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const seoulTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** YYYY-MM-DD of this instant in Seoul */
function seoulDateString(d: Date): string {
  return seoulDateFormatter.format(d);
}

/** New calendar block from task deadline: same calendar day in Korea, default 09:00 KST */
function defaultStartForDueDate(due: Date): Date {
  const day = seoulDateString(due);
  return fromZonedTime(`${day}T09:00:00`, TZ);
}

/** Keep event clock time in Seoul, move to the Seoul calendar day of `due` */
function mergeDueDateIntoEventStart(due: Date, previousStart: Date): Date {
  const day = seoulDateString(due);
  const timeParts = seoulTimeFormatter.formatToParts(previousStart);
  const h = timeParts.find((p) => p.type === "hour")?.value ?? "09";
  const min = timeParts.find((p) => p.type === "minute")?.value ?? "00";
  const s = timeParts.find((p) => p.type === "second")?.value ?? "00";
  return fromZonedTime(`${day}T${h}:${min}:${s}`, TZ);
}

export async function syncTaskToCalendar(task: Task): Promise<void> {
  const existing = await prisma.calendarEvent.findFirst({
    where: { linkedTaskId: task.id },
  });

  // Keep the calendar block when the task is done — UI shows it muted; remove only if no due date.
  const shouldHaveBlock = task.dueDate != null;

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

  const day = seoulDateString(new Date(event.startDateTime));
  const dueDayKstMidnight = fromZonedTime(`${day}T00:00:00`, TZ);
  const task = await prisma.task.create({
    data: {
      userId: event.userId,
      title: event.title,
      detail: event.detail,
      expectedWorkload: clampWorkload(event.expectedWorkload),
      dueDate: dueDayKstMidnight,
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

  const day = seoulDateString(new Date(event.startDateTime));
  const dueDayKstMidnight = fromZonedTime(`${day}T00:00:00`, TZ);
  await prisma.task.update({
    where: { id: event.linkedTaskId },
    data: {
      title: event.title,
      detail: event.detail,
      expectedWorkload: clampWorkload(event.expectedWorkload),
      dueDate: dueDayKstMidnight,
    },
  });
}

export async function syncTaskAndCalendar(taskId: string): Promise<void> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return;
  await syncTaskToCalendar(task);
}

/**
 * Older versions deleted calendar rows when a task was marked done. Recreate blocks for
 * completed tasks that still have a due date but no linked event (visible range only).
 */
export async function repairDoneTasksMissingCalendarBlocks(
  userId: string,
  range: { start: Date; end: Date },
): Promise<void> {
  const candidates = await prisma.task.findMany({
    where: {
      userId,
      status: "done",
      dueDate: {
        not: null,
        gte: range.start,
        lt: range.end,
      },
    },
    include: { calendarEvent: true },
  });
  for (const t of candidates) {
    if (t.calendarEvent === null) {
      await syncTaskToCalendar(t);
    }
  }
}
