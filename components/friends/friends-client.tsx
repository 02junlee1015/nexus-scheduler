"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";
import { UserRound } from "lucide-react";

type FriendshipDTO = {
  id: string;
  requesterUserId: string;
  addresseeUserId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  peer: { id: string; email: string; name: string };
};

type FriendsPayload = {
  incoming: FriendshipDTO[];
  outgoing: FriendshipDTO[];
  accepted: FriendshipDTO[];
  pendingInvites?: { id: string; email: string; createdAt: string; expiresAt: string }[];
};

function initials(name: string, email: string) {
  const s = (name || email).trim();
  if (!s) return "?";
  const parts = s.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  }
  return s.slice(0, 2).toUpperCase();
}

function peerLabel(f: FriendshipDTO) {
  return f.peer.name?.trim() || f.peer.email;
}

export function FriendsClient() {
  const router = useRouter();
  const bump = useAppStore((s) => s.bumpDataEpoch);
  const dataEpoch = useAppStore((s) => s.dataEpoch);
  const [data, setData] = useState<FriendsPayload | null>(null);
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [teamName, setTeamName] = useState("");
  const [teamPick, setTeamPick] = useState<Set<string>>(() => new Set());
  const [teamError, setTeamError] = useState<string | null>(null);
  const [teamBusy, setTeamBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/friends");
    if (!r.ok) return;
    const j = (await r.json()) as FriendsPayload;
    setData({
      ...j,
      pendingInvites: j.pendingInvites ?? [],
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load, dataEpoch]);

  function toggleTeamMember(peerUserId: string) {
    setTeamPick((prev) => {
      const n = new Set(prev);
      if (n.has(peerUserId)) n.delete(peerUserId);
      else n.add(peerUserId);
      return n;
    });
  }

  async function sendRequest(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setLoading(true);
    try {
      const r = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setFormError(
          typeof j.error === "string" ? j.error : "Could not send request",
        );
        return;
      }
      const peerEmail =
        j && typeof j === "object" && "peer" in j
          ? (j as { peer?: { email?: string } }).peer?.email
          : undefined;
      setFormSuccess(
        peerEmail
          ? `Friend request sent. They’ll see it under Incoming.`
          : "Friend request sent.",
      );
      setEmail("");
      bump();
    } finally {
      setLoading(false);
    }
  }

  async function accept(id: string) {
    await fetch(`/api/friends/${id}/accept`, { method: "POST" });
    bump();
  }

  async function reject(id: string) {
    await fetch(`/api/friends/${id}/reject`, { method: "POST" });
    bump();
  }

  async function cancelOutgoing(id: string) {
    await fetch(`/api/friends/${id}/cancel`, { method: "POST" });
    bump();
  }

  async function removeAcceptedFriend(f: FriendshipDTO) {
    if (!confirm(`Remove ${peerLabel(f)} from your friends?`)) return;
    const r = await fetch(`/api/friends/${f.id}`, { method: "DELETE" });
    if (!r.ok) return;
    setTeamPick((prev) => {
      const n = new Set(prev);
      n.delete(f.peer.id);
      return n;
    });
    bump();
  }

  async function submitCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    setTeamError(null);
    const name = teamName.trim();
    if (!name) {
      setTeamError("Name your team.");
      return;
    }
    if (teamPick.size === 0) {
      setTeamError("Select at least one friend to add to the team.");
      return;
    }
    setTeamBusy(true);
    try {
      const r = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          memberUserIds: [...teamPick],
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setTeamError(
          typeof j.error === "string" ? j.error : "Could not create team",
        );
        return;
      }
      setTeamName("");
      setTeamPick(new Set());
      bump();
      router.push(`/team/${(j as { id: string }).id}`);
    } finally {
      setTeamBusy(false);
    }
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-5xl animate-pulse space-y-6 py-4">
        <div className="h-10 w-40 rounded-xl bg-neutral-200/70 dark:bg-neutral-800" />
        <div className="h-24 rounded-2xl bg-neutral-200/50 dark:bg-neutral-800/80" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Friends
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Add or remove friends. Build a team from accepted friends — use the{" "}
          <Link href="/team" className="font-medium underline">
            Team
          </Link>{" "}
          page to view shared calendars. Send tasks from{" "}
          <Link href="/tasks" className="font-medium underline">
            Tasks
          </Link>
          .
        </p>
      </header>

      <form
        onSubmit={(e) => void sendRequest(e)}
        className="rounded-3xl border border-neutral-200/80 bg-white/80 p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/50"
      >
        <Label htmlFor="friend-email" className="text-xs uppercase tracking-wider text-neutral-500">
          Member sign-up email
        </Label>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Same address they used when creating their Nexus account — like a user
          ID for lookup.
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            id="friend-email"
            type="email"
            placeholder="their-signup-email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="sm:max-w-md"
            autoComplete="off"
          />
          <Button
            type="submit"
            disabled={loading || !email.trim()}
            className="rounded-2xl sm:w-auto"
          >
            Send friend request
          </Button>
        </div>
        {formError ? (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {formError}
          </p>
        ) : null}
        {formSuccess ? (
          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">
            {formSuccess}
          </p>
        ) : null}
      </form>

      <div className="grid gap-10 lg:grid-cols-[1fr,minmax(280px,380px)]">
        <div className="space-y-10">
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Incoming
            </h2>
            {data.incoming.length === 0 ? (
              <p className="mt-3 rounded-2xl border border-dashed border-neutral-300/90 bg-white/40 px-5 py-10 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900/30">
                No pending requests.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.incoming.map((f) => (
                  <li
                    key={f.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200/80 bg-white/90 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 text-xs font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                        {initials(f.peer.name, f.peer.email)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-neutral-900 dark:text-neutral-50">
                          {peerLabel(f)}
                        </p>
                        <p className="truncate text-xs text-neutral-500">
                          {f.peer.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => void accept(f.id)}
                      >
                        Accept
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="rounded-xl"
                        onClick={() => void reject(f.id)}
                      >
                        Decline
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Outgoing
            </h2>
            {data.outgoing.length === 0 ? (
              <p className="mt-3 rounded-2xl border border-dashed border-neutral-300/90 bg-white/40 px-5 py-10 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900/30">
                Nothing waiting.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.outgoing.map((f) => (
                  <li
                    key={f.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200/80 bg-white/90 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 text-xs font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                        {initials(f.peer.name, f.peer.email)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-neutral-900 dark:text-neutral-50">
                          {peerLabel(f)}
                        </p>
                        <p className="text-xs text-neutral-500">Pending</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => void cancelOutgoing(f.id)}
                    >
                      Cancel
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Friends
            </h2>
            {data.accepted.length === 0 ? (
              <p className="mt-3 rounded-2xl border border-dashed border-neutral-300/90 bg-white/40 px-5 py-10 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900/30">
                Accepted friends appear here.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.accepted.map((f) => (
                  <li
                    key={f.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200/80 bg-white/90 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60"
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={teamPick.has(f.peer.id)}
                        onChange={() => toggleTeamMember(f.peer.id)}
                        className="h-4 w-4 rounded border-neutral-300"
                      />
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 text-xs font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                        {initials(f.peer.name, f.peer.email)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-neutral-900 dark:text-neutral-50">
                          {peerLabel(f)}
                        </span>
                        <span className="block truncate text-xs text-neutral-500">
                          {f.peer.email}
                        </span>
                      </span>
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="shrink-0 rounded-xl text-neutral-500"
                      onClick={() => void removeAcceptedFriend(f)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-3xl border border-neutral-200/80 bg-white/90 p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
              Build a team
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Tick friends above, name the team, and create. You are included
              automatically. Then open Team to see everyone’s load and a shared
              calendar.
            </p>
            <form
              onSubmit={(e) => void submitCreateTeam(e)}
              className="mt-4 space-y-4"
            >
              <div>
                <Label htmlFor="team-name">Team name</Label>
                <Input
                  id="team-name"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. Study group"
                  className="mt-1.5"
                  maxLength={120}
                />
              </div>
              {teamError ? (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {teamError}
                </p>
              ) : null}
              <Button
                type="submit"
                className="w-full rounded-2xl"
                disabled={
                  teamBusy ||
                  !teamName.trim() ||
                  teamPick.size === 0 ||
                  data.accepted.length === 0
                }
              >
                {teamBusy ? "Creating…" : "Create team"}
              </Button>
            </form>
            <Link
              href="/team"
              className={cn(
                "mt-4 block text-center text-sm font-medium text-neutral-600 underline dark:text-neutral-300",
              )}
            >
              View teams
            </Link>
            {data.accepted.length === 0 ? (
              <div className="mt-6 flex flex-col items-center py-4 text-center text-sm text-neutral-500">
                <UserRound className="mb-2 h-8 w-8 opacity-40" strokeWidth={1.25} />
                <p>Add friends first to create a team.</p>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
