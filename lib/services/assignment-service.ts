import { prisma } from "@/lib/db";
import { clampWorkload } from "@/lib/constants/workload";
import * as notificationService from "@/lib/services/notification-service";
import * as emailService from "@/lib/services/email-service";
import * as friendshipService from "@/lib/services/friendship-service";
import * as taskService from "@/lib/services/task-service";

export type AssignedTaskRequestDTO = {
  id: string;
  senderUserId: string;
  recipientUserId: string;
  title: string;
  detail: string;
  deadline: string | null;
  expectedWorkload: number;
  status: string;
  recipientResponseMessage: string;
  proposedDeadline: string | null;
  linkedRecipientTaskId: string | null;
  createdAt: string;
  updatedAt: string;
  sender: { id: string; email: string; name: string };
  recipient: { id: string; email: string; name: string };
};

type UserStub = { id: string; email: string; name: string };

async function loadUsersByIds(ids: Iterable<string>): Promise<Map<string, UserStub>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, email: true, name: true },
  });
  return new Map(rows.map((u) => [u.id, u]));
}

async function loadUsers(senderId: string, recipientId: string) {
  const m = await loadUsersByIds([senderId, recipientId]);
  const sender = m.get(senderId);
  const recipient = m.get(recipientId);
  if (!sender || !recipient) throw new Error("USER_NOT_FOUND");
  return { sender, recipient };
}

function toDTO(
  row: {
    id: string;
    senderUserId: string;
    recipientUserId: string;
    title: string;
    detail: string;
    deadline: Date | null;
    expectedWorkload: number;
    status: string;
    recipientResponseMessage: string;
    proposedDeadline: Date | null;
    linkedRecipientTaskId: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  sender: { id: string; email: string; name: string },
  recipient: { id: string; email: string; name: string },
): AssignedTaskRequestDTO {
  return {
    id: row.id,
    senderUserId: row.senderUserId,
    recipientUserId: row.recipientUserId,
    title: row.title,
    detail: row.detail,
    deadline: row.deadline?.toISOString() ?? null,
    expectedWorkload: clampWorkload(row.expectedWorkload),
    status: row.status,
    recipientResponseMessage: row.recipientResponseMessage,
    proposedDeadline: row.proposedDeadline?.toISOString() ?? null,
    linkedRecipientTaskId: row.linkedRecipientTaskId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    sender,
    recipient,
  };
}

export async function createAssignment(
  senderUserId: string,
  input: {
    recipientUserId: string;
    title: string;
    detail?: string;
    deadline?: string | null;
    expectedWorkload?: number;
  },
): Promise<AssignedTaskRequestDTO> {
  await friendshipService.assertAcceptedFriends(
    senderUserId,
    input.recipientUserId,
  );

  const row = await prisma.assignedTaskRequest.create({
    data: {
      senderUserId,
      recipientUserId: input.recipientUserId,
      title: input.title.trim(),
      detail: (input.detail ?? "").trim(),
      deadline:
        input.deadline != null && input.deadline !== ""
          ? new Date(input.deadline)
          : null,
      expectedWorkload: clampWorkload(input.expectedWorkload ?? 2),
      status: "pending",
    },
  });

  const { sender, recipient } = await loadUsers(senderUserId, input.recipientUserId);
  await notificationService.createNotification({
    userId: input.recipientUserId,
    type: "task_assigned",
    title: "새 작업이 도착했습니다!",
    message: `${sender.name || sender.email}님이 "${row.title}"을(를) 보냈습니다.`,
    relatedEntityType: "assigned_task_request",
    relatedEntityId: row.id,
  });

  await emailService.sendCollaborationEmail({
    to: recipient.email,
    subject: `[Nexus Scheduler] 새 작업: ${row.title}`,
    text: `${sender.name || sender.email}님이 작업을 보냈습니다.\n\n제목: ${row.title}`,
    path: `/tasks/${row.id}`,
  });

  return toDTO(row, sender, recipient);
}

export async function getAssignment(
  id: string,
  viewerUserId: string,
): Promise<AssignedTaskRequestDTO | null> {
  const row = await prisma.assignedTaskRequest.findUnique({ where: { id } });
  if (!row) return null;
  if (
    row.senderUserId !== viewerUserId &&
    row.recipientUserId !== viewerUserId
  ) {
    return null;
  }
  const { sender, recipient } = await loadUsers(
    row.senderUserId,
    row.recipientUserId,
  );
  return toDTO(row, sender, recipient);
}

export async function listAssignmentsForUser(
  userId: string,
  role: "sent" | "received" | "all",
): Promise<AssignedTaskRequestDTO[]> {
  const where =
    role === "sent"
      ? { senderUserId: userId }
      : role === "received"
        ? { recipientUserId: userId }
        : { OR: [{ senderUserId: userId }, { recipientUserId: userId }] };

  const rows = await prisma.assignedTaskRequest.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const userIds: string[] = [];
  for (const row of rows) {
    userIds.push(row.senderUserId, row.recipientUserId);
  }
  const userMap = await loadUsersByIds(userIds);

  return rows.map((row) => {
    const sender = userMap.get(row.senderUserId);
    const recipient = userMap.get(row.recipientUserId);
    if (!sender || !recipient) throw new Error("USER_NOT_FOUND");
    return toDTO(row, sender, recipient);
  });
}

export async function acceptAssignment(
  assignmentId: string,
  recipientUserId: string,
  opts: { expectedWorkload: number },
): Promise<AssignedTaskRequestDTO> {
  const row = await prisma.assignedTaskRequest.findUnique({
    where: { id: assignmentId },
  });
  if (!row) throw new Error("NOT_FOUND");
  if (row.recipientUserId !== recipientUserId) throw new Error("FORBIDDEN");
  if (!["pending", "updated_resubmitted"].includes(row.status))
    throw new Error("INVALID_STATE");
  if (row.linkedRecipientTaskId)
    throw new Error("ALREADY_ACCEPTED");

  const workload = clampWorkload(opts.expectedWorkload);

  const task = await taskService.createTask({
    userId: recipientUserId,
    title: row.title,
    detail: row.detail,
    expectedWorkload: workload,
    dueDate: row.deadline?.toISOString() ?? null,
    status: "todo",
    source: "assigned",
  });

  const updated = await prisma.assignedTaskRequest.update({
    where: { id: assignmentId },
    data: {
      status: "accepted",
      linkedRecipientTaskId: task.id,
      expectedWorkload: workload,
      recipientResponseMessage: "",
      proposedDeadline: null,
    },
  });

  const { sender, recipient } = await loadUsers(
    row.senderUserId,
    row.recipientUserId,
  );

  await notificationService.createNotification({
    userId: row.senderUserId,
    type: "task_assignment_accepted",
    title: "작업이 수락되었습니다",
    message: `${recipient.name || recipient.email}님이 "${row.title}"을(를) 받았습니다.`,
    relatedEntityType: "assigned_task_request",
    relatedEntityId: updated.id,
  });

  await emailService.sendCollaborationEmail({
    to: sender.email,
    subject: `[Nexus Scheduler] 작업 수락됨: ${row.title}`,
    text: `${recipient.name || recipient.email}님이 "${row.title}" 작업을 수락했습니다.`,
    path: `/tasks/${updated.id}`,
  });

  return toDTO(updated, sender, recipient);
}

export async function requestAdjustment(
  assignmentId: string,
  recipientUserId: string,
  input: { message: string; proposedDeadline?: string | null },
): Promise<AssignedTaskRequestDTO> {
  const row = await prisma.assignedTaskRequest.findUnique({
    where: { id: assignmentId },
  });
  if (!row) throw new Error("NOT_FOUND");
  if (row.recipientUserId !== recipientUserId) throw new Error("FORBIDDEN");
  if (!["pending", "updated_resubmitted"].includes(row.status))
    throw new Error("INVALID_STATE");

  const updated = await prisma.assignedTaskRequest.update({
    where: { id: assignmentId },
    data: {
      status: "adjustment_requested",
      recipientResponseMessage: input.message.trim(),
      proposedDeadline:
        input.proposedDeadline != null && input.proposedDeadline !== ""
          ? new Date(input.proposedDeadline)
          : null,
    },
  });

  const { sender, recipient } = await loadUsers(
    row.senderUserId,
    row.recipientUserId,
  );

  await notificationService.createNotification({
    userId: row.senderUserId,
    type: "task_adjustment_requested",
    title: "조정 요청",
    message: `${recipient.name || recipient.email}님이 "${row.title}" 조정을 요청했습니다.`,
    relatedEntityType: "assigned_task_request",
    relatedEntityId: updated.id,
  });

  await emailService.sendCollaborationEmail({
    to: sender.email,
    subject: `[Nexus Scheduler] 조정 요청: ${row.title}`,
    text: `${recipient.name || recipient.email}님이 "${row.title}"에 대해 조정을 요청했습니다.\n\n메시지: ${input.message.trim()}`,
    path: `/tasks/${updated.id}`,
  });

  return toDTO(updated, sender, recipient);
}

export async function reviseAssignment(
  assignmentId: string,
  senderUserId: string,
  input: {
    title: string;
    detail?: string;
    deadline?: string | null;
  },
): Promise<AssignedTaskRequestDTO> {
  const row = await prisma.assignedTaskRequest.findUnique({
    where: { id: assignmentId },
  });
  if (!row) throw new Error("NOT_FOUND");
  if (row.senderUserId !== senderUserId) throw new Error("FORBIDDEN");
  if (row.status !== "adjustment_requested") throw new Error("INVALID_STATE");

  const updated = await prisma.assignedTaskRequest.update({
    where: { id: assignmentId },
    data: {
      title: input.title.trim(),
      detail: (input.detail ?? row.detail).trim(),
      deadline:
        input.deadline !== undefined
          ? input.deadline === null || input.deadline === ""
            ? null
            : new Date(input.deadline)
          : row.deadline,
      status: "updated_resubmitted",
      recipientResponseMessage: "",
      proposedDeadline: null,
    },
  });

  const { sender, recipient } = await loadUsers(
    row.senderUserId,
    row.recipientUserId,
  );

  await notificationService.createNotification({
    userId: row.recipientUserId,
    type: "task_assigned",
    title: "작업이 다시 보내졌습니다",
    message: `${sender.name || sender.email}님이 "${updated.title}"을(를) 수정해 보냈습니다.`,
    relatedEntityType: "assigned_task_request",
    relatedEntityId: updated.id,
  });

  await emailService.sendCollaborationEmail({
    to: recipient.email,
    subject: `[Nexus Scheduler] 작업이 업데이트되었습니다: ${updated.title}`,
    text: `${sender.name || sender.email}님이 "${updated.title}" 작업을 수정해 다시 보냈습니다.`,
    path: `/tasks/${updated.id}`,
  });

  return toDTO(updated, sender, recipient);
}

export async function cancelAssignment(
  assignmentId: string,
  senderUserId: string,
): Promise<void> {
  const row = await prisma.assignedTaskRequest.findUnique({
    where: { id: assignmentId },
  });
  if (!row) throw new Error("NOT_FOUND");
  if (row.senderUserId !== senderUserId) throw new Error("FORBIDDEN");
  if (row.status === "accepted") throw new Error("INVALID_STATE");
  await prisma.assignedTaskRequest.update({
    where: { id: assignmentId },
    data: { status: "cancelled" },
  });
}

export async function declineAssignment(
  assignmentId: string,
  recipientUserId: string,
): Promise<void> {
  const row = await prisma.assignedTaskRequest.findUnique({
    where: { id: assignmentId },
  });
  if (!row) throw new Error("NOT_FOUND");
  if (row.recipientUserId !== recipientUserId) throw new Error("FORBIDDEN");
  if (!["pending", "updated_resubmitted"].includes(row.status))
    throw new Error("INVALID_STATE");
  await prisma.assignedTaskRequest.update({
    where: { id: assignmentId },
    data: { status: "declined" },
  });
  const { sender, recipient } = await loadUsers(
    row.senderUserId,
    row.recipientUserId,
  );
  await notificationService.createNotification({
    userId: row.senderUserId,
    type: "task_assignment_declined",
    title: "작업이 거절되었습니다",
    message: `${recipient.name || recipient.email}님이 "${row.title}"을(를) 거절했습니다.`,
    relatedEntityType: "assigned_task_request",
    relatedEntityId: row.id,
  });

  await emailService.sendCollaborationEmail({
    to: sender.email,
    subject: `[Nexus Scheduler] 작업 거절: ${row.title}`,
    text: `${recipient.name || recipient.email}님이 "${row.title}" 작업을 거절했습니다.`,
    path: `/tasks/${row.id}`,
  });
}
