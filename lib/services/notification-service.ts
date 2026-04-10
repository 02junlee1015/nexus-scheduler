import { prisma } from "@/lib/db";

export type NotificationDTO = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedEntityType: string;
  relatedEntityId: string;
  isRead: boolean;
  createdAt: string;
};

function toDTO(n: {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedEntityType: string;
  relatedEntityId: string;
  isRead: boolean;
  createdAt: Date;
}): NotificationDTO {
  return {
    id: n.id,
    userId: n.userId,
    type: n.type,
    title: n.title,
    message: n.message,
    relatedEntityType: n.relatedEntityType,
    relatedEntityId: n.relatedEntityId,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  };
}

export async function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  message?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}): Promise<NotificationDTO> {
  const n = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message ?? "",
      relatedEntityType: input.relatedEntityType ?? "",
      relatedEntityId: input.relatedEntityId ?? "",
    },
  });
  return toDTO(n);
}

export async function listNotifications(
  userId: string,
  opts?: { limit?: number; unreadOnly?: boolean },
): Promise<{ items: NotificationDTO[]; unreadCount: number }> {
  const where: { userId: string; isRead?: boolean } = { userId };
  if (opts?.unreadOnly) where.isRead = false;
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: opts?.limit ?? 80,
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);
  return { items: items.map(toDTO), unreadCount };
}

export async function markNotificationRead(
  id: string,
  userId: string,
): Promise<void> {
  await prisma.notification.updateMany({
    where: { id, userId },
    data: { isRead: true },
  });
}

export async function markAllRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}
