"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils/cn";
import { ChevronRight } from "lucide-react";

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
  const dataEpoch = useAppStore((s) => s.dataEpoch);
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: Tab =
    tabParam === "sent" || tabParam === "all" ? tabParam : "inbox";

  const [meId, setMeId] = useState<string | null>(null);
  const [items, setItems] = useState<AssignedDTO[]>([]);
  const [loading, setLoading] = useState(true);

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
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Tasks
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Tasks shared between you and friends — respond or follow up here.
        </p>
      </header>

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
