"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils/cn";
import { workloadVisual, type WorkloadLevel } from "@/lib/constants/workload";
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
import { ChevronRight, Plus } from "lucide-react";

type AssignedDTO = {
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

type Tab = "inbox" | "sent" | "all";

type FriendPeer = { id: string; email: string; name: string };

function statusStyle(status: string): string {
  switch (status) {
    case "pending":
    case "updated_resubmitted":
      return "bg-blue-50 text-blue-900 dark:bg-blue-950/50 dark:text-blue-100";
    case "adjustment_requested":
      return "bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100";
    case "accepted":
      return "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100";
    case "cancelled":
    case "declined":
      return "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400";
    default:
      return "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
  }
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

export function AssignmentsClient() {
  const router = useRouter();
  const bump = useAppStore((s) => s.bumpDataEpoch);
  const dataEpoch = useAppStore((s) => s.dataEpoch);
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: Tab =
    tabParam === "sent" || tabParam === "all" ? tabParam : "inbox";

  const [meId, setMeId] = useState<string | null>(null);
  const [items, setItems] = useState<AssignedDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const [assignOpen, setAssignOpen] = useState(false);
  const [friends, setFriends] = useState<FriendPeer[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [recipientUserId, setRecipientUserId] = useState("");
  const [asgTitle, setAsgTitle] = useState("");
  const [asgDetail, setAsgDetail] = useState("");
  const [asgDeadline, setAsgDeadline] = useState("");
  const [asgWl, setAsgWl] = useState<WorkloadLevel>(2);
  const [asgBusy, setAsgBusy] = useState(false);
  const [asgErr, setAsgErr] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    (async () => {
      const r = await fetch("/api/auth/me");
      const j = await r.json().catch(() => ({}));
      if (!c) setMeId(j.user?.id ?? null);
    })();
    return () => {
      c = true;
    };
  }, []);

  const role =
    tab === "inbox" ? "received" : tab === "sent" ? "sent" : "all";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/assigned-tasks?role=${role}`);
      if (!r.ok) return;
      const j = (await r.json()) as { items: AssignedDTO[] };
      setItems(j.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    void load();
  }, [load, dataEpoch]);

  const loadFriends = useCallback(async () => {
    setFriendsLoading(true);
    try {
      const r = await fetch("/api/friends");
      if (!r.ok) return;
      const j = (await r.json()) as {
        accepted: { peer: FriendPeer }[];
      };
      const peers = (j.accepted ?? []).map((x) => x.peer);
      setFriends(peers);
      setRecipientUserId((cur) => {
        if (cur && peers.some((p) => p.id === cur)) return cur;
        return peers[0]?.id ?? "";
      });
    } finally {
      setFriendsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!assignOpen) return;
    void loadFriends();
  }, [assignOpen, loadFriends]);

  async function submitAssign(e: React.FormEvent) {
    e.preventDefault();
    setAsgErr(null);
    const title = asgTitle.trim();
    if (!title) {
      setAsgErr("Add a title.");
      return;
    }
    if (!recipientUserId) {
      setAsgErr("Pick a friend to assign to.");
      return;
    }
    setAsgBusy(true);
    try {
      const body: Record<string, unknown> = {
        recipientUserId,
        title,
        detail: asgDetail.trim(),
        expectedWorkload: asgWl,
      };
      if (asgDeadline.trim()) {
        body.deadline = new Date(asgDeadline).toISOString();
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
        setAsgErr(
          typeof j.error === "string"
            ? j.error
            : "Could not send. Check you are friends with them.",
        );
        return;
      }
      bump();
      setAssignOpen(false);
      setAsgTitle("");
      setAsgDetail("");
      setAsgDeadline("");
      setAsgWl(2);
      router.push("/tasks?tab=sent");
      router.refresh();
    } finally {
      setAsgBusy(false);
    }
  }

  const filtered = useMemo(() => {
    if (tab === "inbox") {
      return items.filter((a) =>
        ["pending", "updated_resubmitted", "adjustment_requested"].includes(
          a.status,
        ),
      );
    }
    return items;
  }, [items, tab]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "inbox", label: "Inbox" },
    { id: "sent", label: "Sent" },
    { id: "all", label: "All" },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            Tasks
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Assign work to friends, then track inbox and sent here.
          </p>
        </div>
        <Button
          type="button"
          className="shrink-0 gap-2 rounded-2xl"
          onClick={() => {
            setAsgErr(null);
            setAssignOpen(true);
          }}
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Assign task
        </Button>
      </header>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign task to a friend</DialogTitle>
          </DialogHeader>
          {friendsLoading ? (
            <p className="text-sm text-neutral-500">Loading friends…</p>
          ) : friends.length === 0 ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              You need an accepted friend first.{" "}
              <Link href="/friends" className="font-medium underline">
                Open Friends
              </Link>
            </p>
          ) : (
            <form onSubmit={(e) => void submitAssign(e)} className="space-y-4">
              <div>
                <Label htmlFor="assign-to">To</Label>
                <select
                  id="assign-to"
                  value={recipientUserId}
                  onChange={(e) => setRecipientUserId(e.target.value)}
                  className="mt-1.5 flex h-10 w-full rounded-2xl border border-neutral-200/90 bg-white/80 px-4 text-sm dark:border-neutral-700 dark:bg-neutral-900/50"
                  required
                >
                  {friends.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name?.trim() || p.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="assign-title">Title</Label>
                <Input
                  id="assign-title"
                  value={asgTitle}
                  onChange={(e) => setAsgTitle(e.target.value)}
                  className="mt-1.5 rounded-2xl"
                  placeholder="What should they do?"
                  required
                />
              </div>
              <div>
                <Label htmlFor="assign-detail">Detail (optional)</Label>
                <Textarea
                  id="assign-detail"
                  value={asgDetail}
                  onChange={(e) => setAsgDetail(e.target.value)}
                  className="mt-1.5 rounded-2xl"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="assign-dl">Deadline (optional)</Label>
                <Input
                  id="assign-dl"
                  type="datetime-local"
                  value={asgDeadline}
                  onChange={(e) => setAsgDeadline(e.target.value)}
                  className="mt-1.5 rounded-2xl"
                />
              </div>
              <div>
                <Label htmlFor="assign-wl">Suggested workload</Label>
                <select
                  id="assign-wl"
                  value={asgWl}
                  onChange={(e) =>
                    setAsgWl(Number(e.target.value) as WorkloadLevel)
                  }
                  className="mt-1.5 flex h-10 w-full rounded-2xl border border-neutral-200/90 bg-white/80 px-4 text-sm dark:border-neutral-700 dark:bg-neutral-900/50"
                >
                  {([1, 2, 3] as const).map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl} — {workloadVisual[lvl].label}
                    </option>
                  ))}
                </select>
              </div>
              {asgErr ? (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {asgErr}
                </p>
              ) : null}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => setAssignOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={asgBusy}
                  className="rounded-2xl"
                >
                  {asgBusy ? "Sending…" : "Send task"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={
              t.id === "inbox"
                ? "/tasks?tab=inbox"
                : `/tasks?tab=${t.id}`
            }
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition",
              tab === t.id
                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "border border-neutral-200/90 bg-white/80 text-neutral-600 hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-400",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-2xl bg-neutral-200/60 dark:bg-neutral-800/80"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-neutral-300/90 bg-white/50 px-6 py-16 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900/40">
          {tab === "inbox"
            ? "Nothing needs your attention."
            : tab === "sent"
              ? "You have not sent any tasks yet."
              : "No shared tasks yet."}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((a) => {
            const other =
              tab === "inbox"
                ? a.sender
                : tab === "sent"
                  ? a.recipient
                  : meId && a.recipientUserId === meId
                    ? a.sender
                    : a.recipient;
            const otherLabel = other.name?.trim() || other.email;
            const arrow =
              tab === "sent" || (tab === "all" && meId === a.senderUserId)
                ? "→"
                : "←";
            return (
              <li key={a.id}>
                <Link
                  href={`/tasks/${a.id}`}
                  className="group flex items-center justify-between gap-3 rounded-2xl border border-neutral-200/80 bg-white/90 px-4 py-3.5 transition hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900/60 dark:hover:border-neutral-600"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          statusStyle(a.status),
                        )}
                      >
                        {formatStatus(a.status)}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {arrow} {otherLabel}
                      </span>
                    </div>
                    <p className="mt-1 truncate font-medium text-neutral-900 dark:text-neutral-50">
                      {a.title}
                    </p>
                    {a.deadline ? (
                      <p className="text-xs text-neutral-500">
                        Due {format(new Date(a.deadline), "MMM d, yyyy HH:mm")}
                      </p>
                    ) : null}
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-neutral-400 opacity-0 transition group-hover:opacity-100" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
