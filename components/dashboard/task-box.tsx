"use client";

import type { DashboardUrgentTask } from "@/lib/services/dashboard-service";
import { workloadVisual, type WorkloadLevel } from "@/lib/constants/workload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { Trash2 } from "lucide-react";

function badgeVariant(
  b: DashboardUrgentTask["badge"],
): "urgent" | "today" | "default" | "calm" {
  if (b === "Overdue") return "urgent";
  if (b === "Today") return "today";
  if (b === "Soon") return "calm";
  return "default";
}

export function TaskBox({
  task,
  onDelete,
}: {
  task: DashboardUrgentTask;
  onDelete?: (id: string) => void;
}) {
  const w = task.expectedWorkload as WorkloadLevel;
  const v = workloadVisual[w];
  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-2xl border bg-white/90 p-5 transition-shadow duration-300 dark:bg-neutral-900/80",
        v.border,
        v.glow,
        "ring-1 ring-transparent hover:ring-neutral-200/60 dark:hover:ring-neutral-700/50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-neutral-900 dark:text-neutral-50">
          {task.title}
        </h3>
        <div className="flex shrink-0 items-center gap-1">
          <Badge variant={badgeVariant(task.badge)}>{task.badge}</Badge>
          {onDelete ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
              title="삭제"
              onClick={() => onDelete(task.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>
      {task.detail ? (
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
          {task.detail}
        </p>
      ) : (
        <p className="mt-3 text-sm italic text-neutral-400">No detail</p>
      )}
      <div className="mt-4 flex items-center gap-2">
        <span
          className={cn("h-1.5 w-1.5 rounded-full", v.dot)}
          aria-hidden
        />
        <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
          Workload {w} · {v.label}
        </span>
      </div>
    </article>
  );
}
