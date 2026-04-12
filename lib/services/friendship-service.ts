import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import * as notificationService from "@/lib/services/notification-service";
import * as emailService from "@/lib/services/email-service";

export type FriendshipDTO = {
  id: string;
  requesterUserId: string;
  addresseeUserId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  peer: { id: string; email: string; name: string };
};

export type FriendInvitePendingDTO = {
  id: string;
  email: string;
  createdAt: string;
  expiresAt: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function findBetween(
  a: string,
  b: string,
): Promise<{
  id: string;
  requesterUserId: string;
  addresseeUserId: string;
  status: string;
} | null> {
  return prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterUserId: a, addresseeUserId: b },
        { requesterUserId: b, addresseeUserId: a },
      ],
    },
  });
}

async function findBetweenTx(
  tx: Prisma.TransactionClient,
  a: string,
  b: string,
): Promise<{
  id: string;
  requesterUserId: string;
  addresseeUserId: string;
  status: string;
} | null> {
  return tx.friendship.findFirst({
    where: {
      OR: [
        { requesterUserId: a, addresseeUserId: b },
        { requesterUserId: b, addresseeUserId: a },
      ],
    },
  });
}

/** Creates pending friendship + in-app notification; returns id or null if skipped. */
async function createPendingFriendshipInTx(
  tx: Prisma.TransactionClient,
  requesterUserId: string,
  addresseeUserId: string,
): Promise<string | null> {
  const existing = await findBetweenTx(tx, requesterUserId, addresseeUserId);
  if (existing) {
    if (existing.status === "accepted" || existing.status === "pending")
      return null;
    if (existing.status === "rejected" || existing.status === "cancelled") {
      await tx.friendship.delete({ where: { id: existing.id } });
    }
  }
  const row = await tx.friendship.create({
    data: {
      requesterUserId,
      addresseeUserId,
      status: "pending",
    },
  });
  const requester = await tx.user.findUniqueOrThrow({
    where: { id: requesterUserId },
  });
  await tx.notification.create({
    data: {
      userId: addresseeUserId,
      type: "friend_request_received",
      title: "친구 요청",
      message: `${requester.name || requester.email}님이 친구 요청을 보냈습니다.`,
      relatedEntityType: "friendship",
      relatedEntityId: row.id,
    },
  });
  return row.id;
}

/**
 * After a new user row exists: consume token invite (if any) and any other pending invites for this email.
 * Returns friendship ids that were created (for optional follow-up email).
 */
export async function fulfillFriendInvitesAfterUserCreated(
  tx: Prisma.TransactionClient,
  newUserId: string,
  newUserEmail: string,
  inviteToken?: string | null,
): Promise<string[]> {
  const email = normalizeEmail(newUserEmail);
  const created: string[] = [];
  const now = new Date();

  if (inviteToken?.trim()) {
    const inv = await tx.friendInvite.findUnique({
      where: { token: inviteToken.trim() },
    });
    if (
      inv &&
      normalizeEmail(inv.inviteeEmail) === email &&
      inv.expiresAt > now
    ) {
      const id = await createPendingFriendshipInTx(
        tx,
        inv.inviterUserId,
        newUserId,
      );
      if (id) created.push(id);
      await tx.friendInvite.delete({ where: { id: inv.id } });
    }
  }

  const more = await tx.friendInvite.findMany({
    where: { inviteeEmail: email, expiresAt: { gt: now } },
  });
  for (const inv of more) {
    const id = await createPendingFriendshipInTx(tx, inv.inviterUserId, newUserId);
    if (id) created.push(id);
    await tx.friendInvite.delete({ where: { id: inv.id } });
  }

  return created;
}

export async function sendFriendRequest(
  requesterUserId: string,
  emailRaw: string,
): Promise<FriendshipDTO> {
  const email = normalizeEmail(emailRaw);
  if (!email.includes("@")) throw new Error("INVALID_EMAIL");

  const addressee = await prisma.user.findUnique({ where: { email } });
  if (!addressee) throw new Error("USER_NOT_FOUND");

  if (addressee.id === requesterUserId) throw new Error("SELF");

  await prisma.friendInvite.deleteMany({
    where: { inviterUserId: requesterUserId, inviteeEmail: email },
  });

  const existing = await findBetween(requesterUserId, addressee.id);
  if (existing) {
    if (existing.status === "accepted") throw new Error("ALREADY_FRIENDS");
    if (existing.status === "pending") {
      if (existing.requesterUserId === requesterUserId)
        throw new Error("ALREADY_SENT");
      throw new Error("INCOMING_PENDING");
    }
    if (existing.status === "rejected" || existing.status === "cancelled") {
      await prisma.friendship.delete({ where: { id: existing.id } });
    }
  }

  const row = await prisma.friendship.create({
    data: {
      requesterUserId,
      addresseeUserId: addressee.id,
      status: "pending",
    },
  });

  const requester = await prisma.user.findUniqueOrThrow({
    where: { id: requesterUserId },
  });
  await notificationService.createNotification({
    userId: addressee.id,
    type: "friend_request_received",
    title: "친구 요청",
    message: `${requester.name || requester.email}님이 친구 요청을 보냈습니다.`,
    relatedEntityType: "friendship",
    relatedEntityId: row.id,
  });

  await emailService.sendCollaborationEmail({
    to: addressee.email,
    subject: "[Nexus Scheduler] 친구 요청",
    text: `${requester.name || requester.email}님이 Nexus Scheduler에서 친구 요청을 보냈습니다.`,
    path: "/friends",
  });

  return mapFriendship(row.id, requesterUserId);
}

export async function cancelFriendInvite(
  inviteId: string,
  actingUserId: string,
): Promise<void> {
  const row = await prisma.friendInvite.findUnique({ where: { id: inviteId } });
  if (!row) throw new Error("NOT_FOUND");
  if (row.inviterUserId !== actingUserId) throw new Error("FORBIDDEN");
  await prisma.friendInvite.delete({ where: { id: inviteId } });
}

export async function acceptFriendship(
  friendshipId: string,
  actingUserId: string,
): Promise<FriendshipDTO> {
  const row = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });
  if (!row) throw new Error("NOT_FOUND");
  if (row.addresseeUserId !== actingUserId) throw new Error("FORBIDDEN");
  if (row.status !== "pending") throw new Error("INVALID_STATE");

  const updated = await prisma.friendship.update({
    where: { id: friendshipId },
    data: { status: "accepted" },
  });

  const addressee = await prisma.user.findUniqueOrThrow({
    where: { id: actingUserId },
  });
  await notificationService.createNotification({
    userId: row.requesterUserId,
    type: "friend_request_accepted",
    title: "친구 요청 수락됨",
    message: `${addressee.name || addressee.email}님이 요청을 수락했습니다.`,
    relatedEntityType: "friendship",
    relatedEntityId: updated.id,
  });

  const requesterUser = await prisma.user.findUniqueOrThrow({
    where: { id: row.requesterUserId },
    select: { email: true },
  });
  await emailService.sendCollaborationEmail({
    to: requesterUser.email,
    subject: "[Nexus Scheduler] 친구 요청이 수락되었습니다",
    text: `${addressee.name || addressee.email}님이 친구 요청을 수락했습니다.`,
    path: "/friends",
  });

  return mapFriendship(updated.id, actingUserId);
}

export async function rejectFriendship(
  friendshipId: string,
  actingUserId: string,
): Promise<void> {
  const row = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });
  if (!row) throw new Error("NOT_FOUND");
  if (row.addresseeUserId !== actingUserId) throw new Error("FORBIDDEN");
  if (row.status !== "pending") throw new Error("INVALID_STATE");
  await prisma.friendship.update({
    where: { id: friendshipId },
    data: { status: "rejected" },
  });
}

export async function cancelOutgoingFriendship(
  friendshipId: string,
  actingUserId: string,
): Promise<void> {
  const row = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });
  if (!row) throw new Error("NOT_FOUND");
  if (row.requesterUserId !== actingUserId) throw new Error("FORBIDDEN");
  if (row.status !== "pending") throw new Error("INVALID_STATE");
  await prisma.friendship.update({
    where: { id: friendshipId },
    data: { status: "cancelled" },
  });
}

async function mapFriendship(
  id: string,
  viewerUserId: string,
): Promise<FriendshipDTO> {
  const row = await prisma.friendship.findUniqueOrThrow({
    where: { id },
    include: {
      requester: { select: { id: true, email: true, name: true } },
      addressee: { select: { id: true, email: true, name: true } },
    },
  });
  const peer =
    row.requesterUserId === viewerUserId ? row.addressee : row.requester;
  return {
    id: row.id,
    requesterUserId: row.requesterUserId,
    addresseeUserId: row.addresseeUserId,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    peer: { id: peer.id, email: peer.email, name: peer.name },
  };
}

export async function listFriendships(viewerUserId: string): Promise<{
  incoming: FriendshipDTO[];
  outgoing: FriendshipDTO[];
  accepted: FriendshipDTO[];
  pendingInvites: FriendInvitePendingDTO[];
}> {
  const rows = await prisma.friendship.findMany({
    where: {
      OR: [
        { requesterUserId: viewerUserId },
        { addresseeUserId: viewerUserId },
      ],
    },
    include: {
      requester: { select: { id: true, email: true, name: true } },
      addressee: { select: { id: true, email: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const incoming: FriendshipDTO[] = [];
  const outgoing: FriendshipDTO[] = [];
  const accepted: FriendshipDTO[] = [];

  for (const row of rows) {
    const peer =
      row.requesterUserId === viewerUserId ? row.addressee : row.requester;
    const dto: FriendshipDTO = {
      id: row.id,
      requesterUserId: row.requesterUserId,
      addresseeUserId: row.addresseeUserId,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      peer: { id: peer.id, email: peer.email, name: peer.name },
    };
    if (row.status === "accepted") {
      accepted.push(dto);
    } else if (row.status === "pending") {
      if (row.addresseeUserId === viewerUserId) incoming.push(dto);
      else outgoing.push(dto);
    }
  }

  return { incoming, outgoing, accepted, pendingInvites: [] };
}

export async function assertAcceptedFriends(
  a: string,
  b: string,
): Promise<void> {
  const row = await findBetween(a, b);
  if (!row || row.status !== "accepted") throw new Error("NOT_FRIENDS");
}

export async function getFriendshipBetween(
  a: string,
  b: string,
): Promise<{ id: string; status: string } | null> {
  const row = await findBetween(a, b);
  return row ? { id: row.id, status: row.status } : null;
}

/** Remove an accepted friendship (either party). */
export async function removeFriendship(
  friendshipId: string,
  actingUserId: string,
): Promise<void> {
  const row = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });
  if (!row) throw new Error("NOT_FOUND");
  if (
    row.requesterUserId !== actingUserId &&
    row.addresseeUserId !== actingUserId
  ) {
    throw new Error("FORBIDDEN");
  }
  if (row.status !== "accepted") throw new Error("INVALID_STATE");
  await prisma.friendship.delete({ where: { id: friendshipId } });
}
