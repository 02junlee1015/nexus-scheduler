"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useAppStore } from "@/lib/store/app-store";
import type { DashboardUrgentTask } from "@/lib/services/dashboard-service";
import type { TaskDTO } from "@/lib/types/api";
import { TaskBox } from "@/components/dashboard/task-box";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { workloadVisual, type WorkloadLevel } from "@/lib/constants/workload";
import { cn } from "@/lib/utils/cn";
import { Trash2 } from "lucide-react";

type DashboardPayload = {
  summary: {
    totalOpen: number;
    upcomingDeadlines: number;
    completedToday: number;
    workloadDist: Record<1 | 2 | 3, number>;
  };
  collaboration?: {
    assignmentInbox: number;
    assignmentNeedsRevision: number;
  };
  urgentTasks: DashboardUrgentTask[];
  recentTasks: TaskDTO[];
  recentCompleted: TaskDTO[];
};

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200/70 bg-white/80 px-5 py-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-neutral-900 dark:text-neutral-50">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function DashboardClient() {
  const bump = useAppStore((s) => s.bumpDataEpoch);
  const dataEpoch = useAppStore((s) => s.dataEpoch);
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/dashboard");
        if (!r.ok) throw new Error("Failed to load dashboard");
        const j = (await r.json()) as DashboardPayload;
        if (!cancelled) {
          setData(j);
          setErr(null);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dataEpoch]);

  const deleteTask = useCallback(
    async (id: string) => {
      if (
        !confirm("이 작업을 삭제할까요? 연결된 캘린더 일정도 함께 삭제됩니다.")
      ) {
        return;
      }
      await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      bump();
    },
    [bump],
  );

  if (err) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50/80 p-6 text-sm text-red-800">
        {err}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-10 w-48 rounded-xl bg-neutral-200/80" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-neutral-200/60" />
          ))}
        </div>
      </div>
    );
  }

  const { summary, urgentTasks, recentTasks, recentCompleted } = data;
  const workloadDist = summary.workloadDist;

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Urgency first — what needs attention right now.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Open tasks" value={summary.totalOpen} />
        <Stat
          label="Due this week"
          value={summary.upcomingDeadlines}
          hint="Tasks with a deadline in 7 days"
        />
        <Stat label="Completed today" value={summary.completedToday} />
        <div className="rounded-2xl border border-neutral-200/70 bg-white/80 px-5 py-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Workload mix
          </p>
          <div className="mt-3 flex gap-3">
            {([1, 2, 3] as const).map((lvl) => {
              const v = workloadVisual[lvl as WorkloadLevel];
              return (
                <div key={lvl} className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-full", v.dot)} />
                    <span className="text-[10px] font-medium text-neutral-500">
                      {lvl === 1 && "Green "}
                      {lvl === 2 && "Blue "}
                      {lvl === 3 && "Red "}
                      · {lvl}
                    </span>
                  </div>
                  <span className="text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                    {workloadDist[lvl]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {data.collaboration &&
      (data.collaboration.assignmentInbox > 0 ||
        data.collaboration.assignmentNeedsRevision > 0) ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-200/80 bg-white/60 px-4 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-900/50">
          <span className="text-neutral-500">Collaboration</span>
          {data.collaboration.assignmentInbox > 0 ? (
            <Link
              href="/tasks?tab=inbox"
              className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
            >
              {data.collaboration.assignmentInbox} to review
            </Link>
          ) : null}
          {data.collaboration.assignmentNeedsRevision > 0 ? (
            <Link
              href="/tasks?tab=sent"
              className="rounded-full border border-amber-200/80 bg-amber-50/80 px-3 py-1 text-xs font-medium text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
            >
              {data.collaboration.assignmentNeedsRevision} need revision
            </Link>
          ) : null}
        </div>
      ) : null}

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
              Urgent & upcoming
            </h2>
            <p className="text-xs text-neutral-400">
              Sorted by nearest deadline, then workload.
            </p>
          </div>
        </div>
        {urgentTasks.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-neutral-300/90 bg-white/50 px-6 py-16 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900/40">
            No dated open tasks. Add deadlines from To-Do or Calendar.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {urgentTasks.map((t) => (
              <TaskBox key={t.id} task={t} onDelete={deleteTask} />
            ))}
          </div>
        )}
      </section>

      <Separator className="bg-neutral-200/80 dark:bg-neutral-800" />

      <section>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
              최근 완료
            </h2>
            <p className="text-xs text-neutral-400">
              완료 처리된 작업만 모아 표시합니다.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link href="/todo?tab=done">완료 목록 전체 보기</Link>
          </Button>
        </div>
        <ul className="divide-y divide-neutral-200/80 rounded-2xl border border-neutral-200/70 bg-white/80 dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900/50">
          {recentCompleted.length === 0 ? (
            <li className="px-5 py-8 text-center text-sm text-neutral-500">
              아직 완료된 작업이 없습니다.
            </li>
          ) : (
            recentCompleted.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-medium text-neutral-800 line-through decoration-neutral-400 dark:text-neutral-100">
                    {t.title}
                  </span>
                  <p className="text-xs text-neutral-400">
                    완료{" "}
                    {format(new Date(t.updatedAt), "MMM d, yyyy HH:mm")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                  title="삭제"
                  onClick={() => void deleteTask(t.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))
          )}
        </ul>
      </section>

      <Separator className="bg-neutral-200/80 dark:bg-neutral-800" />

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-500">
          Recently ordered (by due date)
        </h2>
        <ul className="divide-y divide-neutral-200/80 rounded-2xl border border-neutral-200/70 bg-white/80 dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900/50">
          {recentTasks.length === 0 ? (
            <li className="px-5 py-8 text-center text-sm text-neutral-500">
              No tasks yet.
            </li>
          ) : (
            recentTasks.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm"
              >
                <span className="min-w-0 font-medium text-neutral-800 dark:text-neutral-100">
                  {t.title}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-neutral-400">
                    {t.dueDate
                      ? new Date(t.dueDate).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                    title="삭제"
                    onClick={() => void deleteTask(t.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
