import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createSession, SESSION_COOKIE } from "@/lib/auth/session";
import { fulfillFriendInvitesAfterUserCreated } from "@/lib/services/friendship-service";
import * as emailService from "@/lib/services/email-service";

const bodySchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  name: z.string().max(120).optional(),
  friendInviteToken: z.string().max(256).optional(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const email = parsed.data.email.trim().toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 },
      );
    }

    const tokenOpt = parsed.data.friendInviteToken?.trim();
    if (tokenOpt) {
      const inv = await prisma.friendInvite.findUnique({
        where: { token: tokenOpt },
      });
      if (!inv || inv.expiresAt <= new Date()) {
        return NextResponse.json(
          { error: "Invalid or expired invite link." },
          { status: 400 },
        );
      }
      if (inv.inviteeEmail.trim().toLowerCase() !== email) {
        return NextResponse.json(
          {
            error: "Use the same email address the invite was sent to.",
          },
          { status: 400 },
        );
      }
    }

    const passwordHash = await hashPassword(parsed.data.password);

    const { user, friendshipIds } = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: (parsed.data.name ?? "").trim(),
        },
      });
      const friendshipIds = await fulfillFriendInvitesAfterUserCreated(
        tx,
        u.id,
        u.email,
        tokenOpt,
      );
      return { user: u, friendshipIds };
    });

    for (const fid of friendshipIds) {
      const row = await prisma.friendship.findUnique({
        where: { id: fid },
        include: {
          requester: { select: { email: true, name: true } },
          addressee: { select: { email: true, name: true } },
        },
      });
      if (row) {
        await emailService.sendCollaborationEmail({
          to: row.addressee.email,
          subject: "[Nexus Scheduler] 친구 요청",
          text: `${row.requester.name || row.requester.email}님이 Nexus Scheduler에서 친구 요청을 보냈습니다.`,
          path: "/friends",
        });
      }
    }

    const token = await createSession(user.id);
    const res = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
    });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (e) {
    console.error("[auth/register]", e);
    const hint = e instanceof Error ? e.message : "Registration failed";
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? hint
            : "Registration failed. Check database connection and migrations.",
      },
      { status: 500 },
    );
  }
}
