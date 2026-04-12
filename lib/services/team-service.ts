import { prisma } from "@/lib/db";
import * as friendshipService from "@/lib/services/friendship-service";
import { clampWorkload } from "@/lib/constants/workload";
import type { CalendarEventDTO, TaskDTO, TaskStatus } from "@/lib/types/api";

export type TeamSummaryDTO = {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
  members: { userId: string; email: string; name: string }[];
};

export type TeamMemberOverviewDTO = {
  userId: string;
  email: string;
  name: string;
  nextTasks: TaskDTO[];
  recentDone: TaskDTO[];
};

function taskToDTO(t: {
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
}): TaskDTO {
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

function eventToDTO(e: {
  id: string;
  userId: string;
  title: string;
  detail: string;
  expectedWorkload: number;
  startDateTime: Date;
  endDateTime: Date;
  linkedTaskId: string | null;
  source: string;
  createdAt: Date;
  updatedAt: Date;
  task?: { status: string } | null;
}): CalendarEventDTO {
  const linkedTaskStatus: TaskStatus | null =
    e.linkedTaskId && e.task ? (e.task.status as TaskStatus) : null;
  return {
    id: e.id,
    title: e.title,
    detail: e.detail,
    expectedWorkload: clampWorkload(e.expectedWorkload),
    startDateTime: e.startDateTime.toISOString(),
    endDateTime: e.endDateTime.toISOString(),
    linkedTaskId: e.linkedTaskId,
    linkedTaskStatus,
    source: e.source as CalendarEventDTO["source"],
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

async function assertMember(teamId: string, userId: string): Promise<void> {
  const m = await prisma.teamMember.findFirst({
    where: { teamId, userId },
  });
  if (!m) throw new Error("NOT_MEMBER");
}

async function memberUserIds(teamId: string): Promise<string[]> {
  const rows = await prisma.teamMember.findMany({
    where: { teamId },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

export async function createTeam(
  ownerUserId: string,
  input: { name: string; memberUserIds: string[] },
): Promise<TeamSummaryDTO> {
  const name = input.name.trim();
  if (!name) throw new Error("INVALID_NAME");

  const friendIds = [...new Set(input.memberUserIds.filter((id) => id !== ownerUserId))];
  if (friendIds.length === 0) throw new Error("NEED_ONE_TEAMMATE");

  for (const fid of friendIds) {
    await friendshipService.assertAcceptedFriends(ownerUserId, fid);
  }

  const team = await prisma.team.create({
    data: {
      name,
      ownerUserId,
      members: {
        create: [
          { userId: ownerUserId },
          ...friendIds.map((userId) => ({ userId })),
        ],
      },
    },
    include: {
      members: { include: { user: { select: { id: true, email: true, name: true } } } },
    },
  });

  return {
    id: team.id,
    name: team.name,
    ownerUserId: team.ownerUserId,
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString(),
    members: team.members.map((m) => ({
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
    })),
  };
}

export async function listTeamsForUser(userId: string): Promise<TeamSummaryDTO[]> {
  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    include: {
      team: {
        include: {
          members: {
            include: { user: { select: { id: true, email: true, name: true } } },
          },
        },
      },
    },
    orderBy: { team: { updatedAt: "desc" } },
  });

  return memberships.map((m) => ({
    id: m.team.id,
    name: m.team.name,
    ownerUserId: m.team.ownerUserId,
    createdAt: m.team.createdAt.toISOString(),
    updatedAt: m.team.updatedAt.toISOString(),
    members: m.team.members.map((x) => ({
      userId: x.user.id,
      email: x.user.email,
      name: x.user.name,
    })),
  }));
}

export async function getTeamSummary(
  teamId: string,
  viewerUserId: string,
): Promise<TeamSummaryDTO | null> {
  await assertMember(teamId, viewerUserId);
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        include: { user: { select: { id: true, email: true, name: true } } },
      },
    },
  });
  if (!team) return null;
  return {
    id: team.id,
    name: team.name,
    ownerUserId: team.ownerUserId,
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString(),
    members: team.members.map((m) => ({
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
    })),
  };
}

export async function getTeamOverview(
  teamId: string,
  viewerUserId: string,
): Promise<{ team: TeamSummaryDTO; members: TeamMemberOverviewDTO[] }> {
  const summary = await getTeamSummary(teamId, viewerUserId);
  if (!summary) throw new Error("NOT_FOUND");

  const ids = await memberUserIds(teamId);
  const byId = new Map(
    summary.members.map((m) => [m.userId, m]),
  );

  const members = await Promise.all(
    ids.map(async (uid) => {
      const u = byId.get(uid);
      if (!u) throw new Error("NOT_FOUND");

      const [nextRaw, doneRows] = await Promise.all([
        prisma.task.findMany({
          where: { userId: uid, status: { not: "done" } },
          take: 40,
          include: { calendarEvent: { select: { id: true } } },
        }),
        prisma.task.findMany({
          where: { userId: uid, status: "done" },
          orderBy: { updatedAt: "desc" },
          take: 8,
          include: { calendarEvent: { select: { id: true } } },
        }),
      ]);

      const nextRows = [...nextRaw].sort((a, b) => {
        if (!a.dueDate && !b.dueDate)
          return b.createdAt.getTime() - a.createdAt.getTime();
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.getTime() - b.dueDate.getTime();
      }).slice(0, 6);

      return {
        userId: u.userId,
        email: u.email,
        name: u.name,
        nextTasks: nextRows.map(taskToDTO),
        recentDone: doneRows.map(taskToDTO),
      };
    }),
  );

  return { team: summary, members };
}

export type TeamCalendarEventDTO = CalendarEventDTO & {
  memberUserId: string;
  memberName: string;
};

export async function listTeamEvents(
  teamId: string,
  viewerUserId: string,
  range: { start: Date; end: Date },
): Promise<TeamCalendarEventDTO[]> {
  await assertMember(teamId, viewerUserId);
  const ids = await memberUserIds(teamId);
  if (ids.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
  });
  const labelById = new Map(
    users.map((u) => [u.id, u.name?.trim() || u.email || u.id]),
  );

  const rows = await prisma.calendarEvent.findMany({
    where: {
      userId: { in: ids },
      AND: [
        { startDateTime: { lt: range.end } },
        { endDateTime: { gt: range.start } },
      ],
    },
    orderBy: { startDateTime: "asc" },
    include: { task: { select: { status: true } } },
    take: 2000,
  });

  return rows.map((e) => ({
    ...eventToDTO({ ...e, userId: e.userId }),
    memberUserId: e.userId,
    memberName: labelById.get(e.userId) ?? e.userId,
  }));
}

export async function deleteTeam(teamId: string, actingUserId: string): Promise<void> {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new Error("NOT_FOUND");
  if (team.ownerUserId !== actingUserId) throw new Error("FORBIDDEN");
  await prisma.team.delete({ where: { id: teamId } });
}
