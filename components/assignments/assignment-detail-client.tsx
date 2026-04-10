"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
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
import { workloadVisual, type WorkloadLevel } from "@/lib/constants/workload";
import { cn } from "@/lib/utils/cn";
import { ArrowLeft } from "lucide-react";

type Me = { id: string; email: string; name: string };

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

function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AssignmentDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const bump = useAppStore((s) => s.bumpDataEpoch);
  const [me, setMe] = useState<Me | null>(null);
  const [row, setRow] = useState<AssignedDTO | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjMessage, setAdjMessage] = useState("");
  const [adjDeadline, setAdjDeadline] = useState("");

  const [revTitle, setRevTitle] = useState("");
  const [revDetail, setRevDetail] = useState("");
  const [revDeadline, setRevDeadline] = useState("");
  const [revWl, setRevWl] = useState<WorkloadLevel>(2);

  const load = useCallback(async () => {
    setErr(null);
    const [rMe, rRow] = await Promise.all([
      fetch("/api/auth/me"),
      fetch(`/api/assigned-tasks/${id}`),
    ]);
    const jMe = await rMe.json().catch(() => ({}));
    if (!jMe.user) {
      setErr("Sign in required.");
      return;
    }
    setMe(jMe.user);
    if (!rRow.ok) {
      setErr(rRow.status === 404 ? "Not found." : "Could not load.");
      return;
    }
    const a = (await rRow.json()) as AssignedDTO;
    setRow(a);
    setRevTitle(a.title);
    setRevDetail(a.detail);
    setRevDeadline(isoToLocalInput(a.deadline));
    setRevWl(a.expectedWorkload as WorkloadLevel);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const isRecipient = me && row && row.recipientUserId === me.id;
  const isSender = me && row && row.senderUserId === me.id;

  async function accept() {
    if (!row) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/assigned-tasks/${row.id}/accept`, {
        method: "POST",
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErr(typeof j.error === "string" ? j.error : "Failed");
        return;
      }
      const next = (await r.json()) as AssignedDTO;
      setRow(next);
      bump();
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    if (!row || !confirm("Decline this assignment?")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/assigned-tasks/${row.id}/decline`, {
        method: "POST",
      });
      if (!r.ok) return;
      bump();
      router.push("/assignments?tab=inbox");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!row || !confirm("Cancel this assignment?")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/assigned-tasks/${row.id}/cancel`, {
        method: "POST",
      });
      if (!r.ok) return;
      bump();
      router.push("/assignments?tab=sent");
    } finally {
      setBusy(false);
    }
  }

  async function submitAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!row) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        message: adjMessage.trim(),
      };
      if (adjDeadline.trim()) {
        body.proposedDeadline = new Date(adjDeadline).toISOString();
      } else {
        body.proposedDeadline = null;
      }
      const r = await fetch(`/api/assigned-tasks/${row.id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(typeof j.error === "string" ? j.error : "Failed");
        return;
      }
      setRow(j as AssignedDTO);
      setAdjustOpen(false);
      setAdjMessage("");
      setAdjDeadline("");
      bump();
    } finally {
      setBusy(false);
    }
  }

  async function submitRevise(e: React.FormEvent) {
    e.preventDefault();
    if (!row) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        title: revTitle.trim(),
        detail: revDetail.trim(),
        expectedWorkload: revWl,
      };
      if (revDeadline.trim()) {
        body.deadline = new Date(revDeadline).toISOString();
      } else {
        body.deadline = null;
      }
      const r = await fetch(`/api/assigned-tasks/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(typeof j.error === "string" ? j.error : "Failed");
        return;
      }
      setRow(j as AssignedDTO);
      bump();
    } finally {
      setBusy(false);
    }
  }

  if (err && !row) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Button variant="ghost" size="sm" asChild className="rounded-xl -ml-2">
          <Link href="/assignments" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="rounded-2xl border border-red-200 bg-red-50/80 p-6 text-sm text-red-800">
          {err}
        </div>
      </div>
    );
  }

  if (!row || !me) {
    return (
      <div className="mx-auto max-w-2xl animate-pulse space-y-4 py-8">
        <div className="h-8 w-48 rounded-lg bg-neutral-200/70 dark:bg-neutral-800" />
        <div className="h-40 rounded-2xl bg-neutral-200/50 dark:bg-neutral-800/80" />
      </div>
    );
  }

  const canRecipientRespond =
    isRecipient &&
    (row.status === "pending" || row.status === "updated_resubmitted");

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Button variant="ghost" size="sm" asChild className="rounded-xl -ml-2">
        <Link href="/assignments" className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          Assignments
        </Link>
      </Button>

      <article className="rounded-3xl border border-neutral-200/80 bg-white/90 p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          {isRecipient
            ? `From ${row.sender.name || row.sender.email}`
            : isSender
              ? `To ${row.recipient.name || row.recipient.email}`
              : "Assignment"}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          {row.title}
        </h1>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-neutral-500">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
              row.status === "accepted" &&
                "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
              row.status === "adjustment_requested" &&
                "bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100",
            )}
          >
            {row.status.replace(/_/g, " ")}
          </span>
          <span>
            Workload {row.expectedWorkload} —{" "}
            {workloadVisual[row.expectedWorkload as WorkloadLevel]?.label ??
              row.expectedWorkload}
          </span>
          {row.deadline ? (
            <span>
              Due {format(new Date(row.deadline), "MMM d, yyyy HH:mm")}
            </span>
          ) : (
            <span>No deadline</span>
          )}
        </div>
        {row.detail ? (
          <p className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
            {row.detail}
          </p>
        ) : null}

        {row.status === "accepted" && row.linkedRecipientTaskId ? (
          <p className="mt-8 text-sm text-neutral-600 dark:text-neutral-400">
            This task is on your list.{" "}
            <Link
              href="/todo"
              className="font-medium text-neutral-900 underline-offset-4 hover:underline dark:text-neutral-100"
            >
              Open To-Do
            </Link>
          </p>
        ) : null}

        {isRecipient && row.status === "adjustment_requested" ? (
          <p className="mt-8 rounded-2xl border border-neutral-200/80 bg-neutral-50/80 px-4 py-3 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-400">
            You asked for an adjustment. Waiting for the sender to update and
            resend.
          </p>
        ) : null}

        {isSender && row.status === "adjustment_requested" ? (
          <div className="mt-8 space-y-4 rounded-2xl border border-amber-200/60 bg-amber-50/50 p-5 dark:border-amber-900/40 dark:bg-amber-950/20">
            <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
              Adjustment requested
            </p>
            {row.recipientResponseMessage ? (
              <p className="whitespace-pre-wrap text-sm text-neutral-800 dark:text-neutral-200">
                {row.recipientResponseMessage}
              </p>
            ) : null}
            {row.proposedDeadline ? (
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Proposed deadline:{" "}
                {format(new Date(row.proposedDeadline), "MMM d, yyyy HH:mm")}
              </p>
            ) : null}
            <form onSubmit={(e) => void submitRevise(e)} className="space-y-4">
              <div>
                <Label htmlFor="rev-title">Title</Label>
                <Input
                  id="rev-title"
                  value={revTitle}
                  onChange={(e) => setRevTitle(e.target.value)}
                  className="mt-1.5"
                  required
                />
              </div>
              <div>
                <Label htmlFor="rev-detail">Detail</Label>
                <Textarea
                  id="rev-detail"
                  value={revDetail}
                  onChange={(e) => setRevDetail(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="rev-dl">Deadline</Label>
                <Input
                  id="rev-dl"
                  type="datetime-local"
                  value={revDeadline}
                  onChange={(e) => setRevDeadline(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="rev-wl">Workload</Label>
                <select
                  id="rev-wl"
                  value={revWl}
                  onChange={(e) =>
                    setRevWl(Number(e.target.value) as WorkloadLevel)
                  }
                  className="mt-1.5 flex h-10 w-full rounded-2xl border border-neutral-200/90 bg-white/80 px-4 text-sm dark:border-neutral-700 dark:bg-neutral-900/50"
                >
                  {([1, 2, 3] as const).map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  disabled={busy}
                  className="rounded-2xl"
                >
                  Update & resend
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  className="rounded-2xl"
                  onClick={() => void cancel()}
                >
                  Cancel assignment
                </Button>
              </div>
            </form>
          </div>
        ) : null}

        {canRecipientRespond ? (
          <div className="mt-10 flex flex-wrap gap-3">
            <Button
              type="button"
              className="rounded-2xl"
              disabled={busy}
              onClick={() => void accept()}
            >
              Accept
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="rounded-2xl"
              disabled={busy}
              onClick={() => setAdjustOpen(true)}
            >
              Request adjustment
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="rounded-2xl text-neutral-500"
              disabled={busy}
              onClick={() => void decline()}
            >
              Decline
            </Button>
          </div>
        ) : null}

        {isSender &&
        (row.status === "pending" || row.status === "updated_resubmitted") ? (
          <div className="mt-10">
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              disabled={busy}
              onClick={() => void cancel()}
            >
              Cancel assignment
            </Button>
          </div>
        ) : null}

        {err && row ? (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">{err}</p>
        ) : null}
      </article>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request adjustment</DialogTitle>
            <p className="text-sm text-neutral-500">
              Explain what should change. You can suggest a new deadline.
            </p>
          </DialogHeader>
          <form onSubmit={(e) => void submitAdjust(e)} className="space-y-4">
            <div>
              <Label htmlFor="adj-msg">Message</Label>
              <Textarea
                id="adj-msg"
                value={adjMessage}
                onChange={(e) => setAdjMessage(e.target.value)}
                className="mt-1.5"
                required
                maxLength={4000}
              />
            </div>
            <div>
              <Label htmlFor="adj-dl">Proposed deadline (optional)</Label>
              <Input
                id="adj-dl"
                type="datetime-local"
                value={adjDeadline}
                onChange={(e) => setAdjDeadline(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <Button
              type="submit"
              disabled={busy || !adjMessage.trim()}
              className="w-full rounded-2xl"
            >
              Send request
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
