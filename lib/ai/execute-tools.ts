import { z } from "zod";
import { prisma } from "@/lib/db";
import * as taskService from "@/lib/services/task-service";
import * as eventService from "@/lib/services/event-service";
import * as friendshipService from "@/lib/services/friendship-service";
import * as assignmentService from "@/lib/services/assignment-service";
import * as notificationService from "@/lib/services/notification-service";
import { syncTaskAndCalendar } from "@/lib/services/sync-service";

export type ToolContext = {
  userId: string;
};

const createTaskSchema = z.object({
  title: z.string(),
  detail: z.string().optional(),
  classification: z.string().max(120).optional(),
  expectedWorkload: z.number().int().min(1).max(3).optional(),
  dueDate: z.string().nullable().optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
});

const updateTaskSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  detail: z.string().optional(),
  classification: z.string().max(120).optional(),
  expectedWorkload: z.number().int().min(1).max(3).optional(),
  dueDate: z.string().nullable().optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  source: z.enum(["manual", "calendar", "ai", "assigned"]).optional(),
});

const idSchema = z.object({ id: z.string() });

const createEventSchema = z.object({
  title: z.string(),
  detail: z.string().optional(),
  expectedWorkload: z.number().int().min(1).max(3).optional(),
  startDateTime: z.string(),
  endDateTime: z.string().optional(),
});

const updateEventSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  detail: z.string().optional(),
  expectedWorkload: z.number().int().min(1).max(3).optional(),
  startDateTime: z.string().optional(),
  endDateTime: z.string().optional(),
});

const queryTasksSchema = z.object({
  status: z.string().optional(),
  titleContains: z.string().optional(),
  dueBefore: z.string().optional(),
  dueAfter: z.string().optional(),
  minWorkload: z.number().optional(),
  limit: z.number().optional(),
});

const queryEventsSchema = z.object({
  startAfter: z.string().optional(),
  startBefore: z.string().optional(),
  titleContains: z.string().optional(),
  limit: z.number().optional(),
});

const syncSchema = z.object({ taskId: z.string() });

async function resolveUserIdByEmail(email: string): Promise<string | null> {
  const u = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true },
  });
  return u?.id ?? null;
}

export async function executeSchedulerTool(
  name: string,
  rawArgs: unknown,
  ctx: ToolContext,
): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  const { userId } = ctx;
  try {
    switch (name) {
      case "createTask": {
        const a = createTaskSchema.parse(rawArgs);
        const t = await taskService.createTask({
          ...a,
          userId,
          source: "ai",
          dueDate: a.dueDate ?? undefined,
        });
        return { ok: true, result: t };
      }
      case "updateTask": {
        const a = updateTaskSchema.parse(rawArgs);
        const t = await taskService.updateTaskForUser(
          { ...a, source: a.source ?? "ai" },
          userId,
        );
        return { ok: true, result: t };
      }
      case "deleteTask": {
        const { id } = idSchema.parse(rawArgs);
        await taskService.deleteTaskForUser(id, userId);
        return { ok: true, result: { deleted: id } };
      }
      case "createEvent": {
        const a = createEventSchema.parse(rawArgs);
        const e = await eventService.createEvent({
          ...a,
          userId,
          source: "ai",
        });
        return { ok: true, result: e };
      }
      case "updateEvent": {
        const a = updateEventSchema.parse(rawArgs);
        const e = await eventService.updateEventForUser(a, userId);
        return { ok: true, result: e };
      }
      case "deleteEvent": {
        const { id } = idSchema.parse(rawArgs);
        await eventService.deleteEventForUser(id, userId);
        return { ok: true, result: { deleted: id } };
      }
      case "queryTasks": {
        const a = queryTasksSchema.parse(rawArgs ?? {});
        const rows = await taskService.queryTasksForAI({ ...a, userId });
        return { ok: true, result: rows };
      }
      case "queryEvents": {
        const a = queryEventsSchema.parse(rawArgs ?? {});
        const rows = await eventService.queryEventsForAI({ ...a, userId });
        return { ok: true, result: rows };
      }
      case "syncTaskAndCalendar": {
        const { taskId } = syncSchema.parse(rawArgs);
        const t = await taskService.getTaskForUser(taskId, userId);
        if (!t) return { ok: false, error: "Task not found" };
        await syncTaskAndCalendar(taskId);
        const again = await taskService.getTaskForUser(taskId, userId);
        return { ok: true, result: again };
      }
      case "sendFriendRequest": {
        const a = z.object({ email: z.string() }).parse(rawArgs);
        try {
          const row = await friendshipService.sendFriendRequest(userId, a.email);
          return { ok: true, result: row };
        } catch (err) {
          if (err instanceof Error && err.message === "USER_NOT_FOUND") {
            return {
              ok: false,
              error:
                "No member with that sign-up email. They must register first.",
            };
          }
          throw err;
        }
      }
      case "acceptFriendRequest": {
        const a = z.object({ friendshipId: z.string() }).parse(rawArgs);
        const row = await friendshipService.acceptFriendship(
          a.friendshipId,
          userId,
        );
        return { ok: true, result: row };
      }
      case "listFriends": {
        const data = await friendshipService.listFriendships(userId);
        return { ok: true, result: data };
      }
      case "assignTaskToFriend": {
        const a = z
          .object({
            recipientEmail: z.string(),
            title: z.string(),
            detail: z.string().optional(),
            deadline: z.string().nullable().optional(),
            expectedWorkload: z.number().int().min(1).max(3).optional(),
          })
          .parse(rawArgs);
        const rid = await resolveUserIdByEmail(a.recipientEmail);
        if (!rid) return { ok: false, error: "Recipient email not found" };
        const row = await assignmentService.createAssignment(userId, {
          recipientUserId: rid,
          title: a.title,
          detail: a.detail,
          deadline: a.deadline ?? undefined,
          expectedWorkload: a.expectedWorkload,
        });
        return { ok: true, result: row };
      }
      case "listAssignedTasks": {
        const a = z
          .object({
            role: z.enum(["sent", "received", "inbox", "all"]).optional(),
          })
          .parse(rawArgs ?? {});
        if (a.role === "inbox") {
          const items = await assignmentService.listAssignmentsForUser(
            userId,
            "received",
          );
          const filtered = items.filter((x) =>
            ["pending", "updated_resubmitted"].includes(x.status),
          );
          return { ok: true, result: filtered };
        }
        const scope =
          a.role === "sent"
            ? "sent"
            : a.role === "received"
              ? "received"
              : "all";
        const items = await assignmentService.listAssignmentsForUser(
          userId,
          scope,
        );
        return { ok: true, result: items };
      }
      case "acceptAssignedTask": {
        const a = z.object({ assignmentId: z.string() }).parse(rawArgs);
        const row = await assignmentService.acceptAssignment(
          a.assignmentId,
          userId,
        );
        return { ok: true, result: row };
      }
      case "requestAssignmentAdjustment": {
        const a = z
          .object({
            assignmentId: z.string(),
            message: z.string(),
            proposedDeadline: z.string().nullable().optional(),
          })
          .parse(rawArgs);
        const row = await assignmentService.requestAdjustment(
          a.assignmentId,
          userId,
          {
            message: a.message,
            proposedDeadline: a.proposedDeadline ?? undefined,
          },
        );
        return { ok: true, result: row };
      }
      case "reviseAssignedTask": {
        const a = z
          .object({
            assignmentId: z.string(),
            title: z.string(),
            detail: z.string().optional(),
            deadline: z.string().nullable().optional(),
            expectedWorkload: z.number().int().min(1).max(3).optional(),
          })
          .parse(rawArgs);
        const row = await assignmentService.reviseAssignment(
          a.assignmentId,
          userId,
          {
            title: a.title,
            detail: a.detail,
            deadline: a.deadline,
            expectedWorkload: a.expectedWorkload,
          },
        );
        return { ok: true, result: row };
      }
      case "cancelAssignedTask": {
        const a = z.object({ assignmentId: z.string() }).parse(rawArgs);
        await assignmentService.cancelAssignment(a.assignmentId, userId);
        return { ok: true, result: { cancelled: a.assignmentId } };
      }
      case "declineAssignedTask": {
        const a = z.object({ assignmentId: z.string() }).parse(rawArgs);
        await assignmentService.declineAssignment(a.assignmentId, userId);
        return { ok: true, result: { declined: a.assignmentId } };
      }
      case "listNotifications": {
        const a = z.object({ limit: z.number().optional() }).parse(rawArgs ?? {});
        const data = await notificationService.listNotifications(userId, {
          limit: a.limit ?? 30,
        });
        return { ok: true, result: data };
      }
      default:
        return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
