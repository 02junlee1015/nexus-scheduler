import { startOfDay, endOfDay, addDays } from "date-fns";
import { prisma } from "@/lib/db";
import { clampWorkload } from "@/lib/constants/workload";
import type { TaskDTO } from "@/lib/types/api";
import { listTasksPaged } from "@/lib/services/task-service";

export type DashboardUrgentTask = TaskDTO & {
  badge: "Overdue" | "Today" | "D-1" | "D-2" | "D-3" | "Soon";
  daysUntil: number;
};

function badgeForDue(
  due: Date,
  now: Date,
): { badge: DashboardUrgentTask["badge"]; daysUntil: number } {
  const startToday = startOfDay(now);
  const dueStart = startOfDay(due);

  if (dueStart.getTime() < startToday.getTime()) {
    const diff = Math.ceil(
      (startToday.getTime() - dueStart.getTime()) / (86400 * 1000),
    );
    return { badge: "Overdue", daysUntil: -diff };
  }
  if (dueStart.getTime() === startToday.getTime()) {
    return { badge: "Today", daysUntil: 0 };
  }

  const diffDays = Math.ceil(
    (dueStart.getTime() - startToday.getTime()) / (86400 * 1000),
  );
  if (diffDays === 1) return { badge: "D-1", daysUntil: 1 };
  if (diffDays === 2) return { badge: "D-2", daysUntil: 2 };
  if (diffDays === 3) return { badge: "D-3", daysUntil: 3 };
  return { badge: "Soon", daysUntil: diffDays };
}

export async function getDashboardData(userId: string) {
  const now = new Date();
  const weekEnd = addDays(now, 7);
  const userWhere = { userId };

  const [
    totalOpen,
    upcomingDeadlines,
    doneTodayCount,
    workloadRows,
    urgentCandidates,
    recentPage,
    recentDonePage,
    linked,
    assignmentInbox,
    assignmentNeedsRevision,
  ] = await Promise.all([
    prisma.task.count({
      where: { userId, status: { not: "done" } },
    }),
    prisma.task.count({
      where: {
        userId,
        status: { not: "done" },
        dueDate: { not: null, lte: weekEnd },
      },
    }),
    prisma.task.count({
      where: {
        userId,
        status: "done",
        updatedAt: { gte: startOfDay(now), lte: endOfDay(now) },
      },
    }),
    prisma.task.groupBy({
      by: ["expectedWorkload"],
      _count: { id: true },
      where: { userId, status: { not: "done" } },
    }),
    prisma.task.findMany({
      where: { userId, status: { not: "done" }, dueDate: { not: null } },
      orderBy: [{ dueDate: "asc" }, { expectedWorkload: "desc" }],
      take: 48,
    }),
    listTasksPaged({ userId, sort: "due" }, 8, 0),
    listTasksPaged({ userId, scope: "done", sort: "updated" }, 8, 0),
    prisma.calendarEvent.findMany({
      where: userWhere,
      select: { id: true, linkedTaskId: true },
    }),
    prisma.assignedTaskRequest.count({
      where: {
        recipientUserId: userId,
        status: { in: ["pending", "updated_resubmitted"] },
      },
    }),
    prisma.assignedTaskRequest.count({
      where: {
        senderUserId: userId,
        status: "adjustment_requested",
      },
    }),
  ]);

  const workloadDist = { 1: 0, 2: 0, 3: 0 } as Record<1 | 2 | 3, number>;
  for (const row of workloadRows) {
    const k = clampWorkload(row.expectedWorkload) as 1 | 2 | 3;
    workloadDist[k] = row._count.id;
  }

  const taskToEvent = new Map(
    linked.filter((l) => l.linkedTaskId).map((l) => [l.linkedTaskId!, l.id]),
  );

  const urgentSource = urgentCandidates
    .map((t) => {
      const { badge, daysUntil } = badgeForDue(t.dueDate!, now);
      return {
        id: t.id,
        title: t.title,
        detail: t.detail,
        classification: t.classification ?? "",
        expectedWorkload: clampWorkload(t.expectedWorkload),
        dueDate: t.dueDate!.toISOString(),
        status: t.status as TaskDTO["status"],
        source: t.source as TaskDTO["source"],
        linkedEventId: taskToEvent.get(t.id) ?? null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        badge,
        daysUntil,
      };
    })
    .sort((a, b) => {
      if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
      return b.expectedWorkload - a.expectedWorkload;
    })
    .slice(0, 12);

  return {
    summary: {
      totalOpen,
      upcomingDeadlines,
      completedToday: doneTodayCount,
      workloadDist,
    },
    collaboration: {
      assignmentInbox,
      assignmentNeedsRevision,
    },
    urgentTasks: urgentSource,
    recentTasks: recentPage.items,
    recentCompleted: recentDonePage.items,
  };
}
