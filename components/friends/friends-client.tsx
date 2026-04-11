"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const bump = useAppStore((s) => s.bumpDataEpoch);
  const dataEpoch = useAppStore((s) => s.dataEpoch);
  const [data, setData] = useState<FriendsPayload | null>(null);
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<FriendshipDTO | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [deadline, setDeadline] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);

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
    if (selected?.id === id) setSelected(null);
  }

  async function reject(id: string) {
    await fetch(`/api/friends/${id}/reject`, { method: "POST" });
    bump();
    if (selected?.id === id) setSelected(null);
  }

  async function cancelOutgoing(id: string) {
    await fetch(`/api/friends/${id}/cancel`, { method: "POST" });
    bump();
    if (selected?.id === id) setSelected(null);
  }

  function openAssign(f: FriendshipDTO) {
    setSelected(f);
    setTitle("");
    setDetail("");
    setDeadline("");
    setAssignError(null);
    setAssignOpen(true);
  }

  async function submitAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setAssignError(null);
    setAssignLoading(true);
    try {
      const body: Record<string, unknown> = {
        recipientUserId: selected.peer.id,
        title: title.trim(),
        detail: detail.trim() || undefined,
      };
      if (deadline.trim()) {
        body.deadline = new Date(deadline).toISOString();
      } else {
        body.deadline = null;
      }
      const r = await fetch("/api/assigned-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setAssignError(
          typeof j.error === "string" ? j.error : "Could not assign task",
        );
        return;
      }
      setAssignOpen(false);
      bump();
    } finally {
      setAssignLoading(false);
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
          Look up members by the email they used to sign up for Nexus. Share
          the app link yourself if they don’t have an account yet.
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

      <div className="grid gap-10 lg:grid-cols-[1fr,minmax(280px,340px)]">
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
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(f)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition",
                        selected?.id === f.id
                          ? "border-neutral-900/30 bg-neutral-50 dark:border-neutral-100/20 dark:bg-neutral-800/80"
                          : "border-neutral-200/80 bg-white/90 hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900/60 dark:hover:border-neutral-600",
                      )}
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
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-3xl border border-neutral-200/80 bg-white/90 p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
            {selected && data.accepted.some((a) => a.id === selected.id) ? (
              <>
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 text-sm font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                    {initials(selected.peer.name, selected.peer.email)}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-900 dark:text-neutral-50">
                      {peerLabel(selected)}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {selected.peer.email}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  className="mt-6 w-full rounded-2xl"
                  onClick={() => openAssign(selected)}
                >
                  Assign task
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center py-8 text-center text-sm text-neutral-500">
                <UserRound className="mb-3 h-10 w-10 opacity-40" strokeWidth={1.25} />
                <p>Select a friend to assign a task.</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign task</DialogTitle>
            <p className="text-sm text-neutral-500">
              To {selected ? peerLabel(selected) : ""}
            </p>
          </DialogHeader>
          <form onSubmit={(e) => void submitAssign(e)} className="space-y-4">
            <div>
              <Label htmlFor="asg-title">Title</Label>
              <Input
                id="asg-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1.5"
                required
                maxLength={500}
              />
            </div>
            <div>
              <Label htmlFor="asg-detail">Detail</Label>
              <Textarea
                id="asg-detail"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                className="mt-1.5 min-h-[100px] rounded-2xl"
                maxLength={8000}
              />
            </div>
            <div>
              <Label htmlFor="asg-deadline">Deadline</Label>
              <Input
                id="asg-deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="mt-1.5"
              />
              <p className="mt-1.5 text-xs text-neutral-500">
                Workload is chosen by them when they accept (affects their to-do
                and calendar block size).
              </p>
            </div>
            {assignError ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                {assignError}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={assignLoading || !title.trim()}
              className="w-full rounded-2xl"
            >
              {assignLoading ? "Sending…" : "Send"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
