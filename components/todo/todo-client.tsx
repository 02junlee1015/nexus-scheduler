"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { useAppStore } from "@/lib/store/app-store";
import type { TaskDTO, TaskStatus } from "@/lib/types/api";
import { workloadVisual, type WorkloadLevel } from "@/lib/constants/workload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils/cn";
import { Plus, Pencil, Trash2, CheckCircle2, RotateCcw } from "lucide-react";

const statuses: TaskStatus[] = ["todo", "in_progress", "done"];

type ListTab = "active" | "done" | "all";

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TodoClient() {
  const searchParams = useSearchParams();
  const bump = useAppStore((s) => s.bumpDataEpoch);
  const dataEpoch = useAppStore((s) => s.dataEpoch);
  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [listTab, setListTab] = useState<ListTab>("active");
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");
  const [sort, setSort] = useState<"due" | "updated" | "created" | "workload">(
    "due",
  );
  const [q, setQ] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TaskDTO | null>(null);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [classification, setClassification] = useState("");
  const [workload, setWorkload] = useState<WorkloadLevel>(2);
  const [due, setDue] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "done") setListTab("done");
    else if (t === "all") setListTab("all");
    else if (t === "active") setListTab("active");
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (listTab === "active") params.set("scope", "active");
    if (listTab === "done") {
      params.set("scope", "done");
      params.set("limit", "300");
    }
    if (listTab === "all" && filterStatus !== "all") {
      params.set("status", filterStatus);
    }
    const effectiveSort =
      listTab === "done" && sort === "due" ? "updated" : sort;
    params.set("sort", effectiveSort);
    params.set("hasDue", "1");
    if (q.trim()) params.set("q", q.trim());

    const r = await fetch(`/api/tasks?${params}`);
    const data = (await r.json()) as
      | TaskDTO[]
      | { items: TaskDTO[]; total: number };
    const rows = Array.isArray(data) ? data : data.items;
    setTasks(rows);
    setLoading(false);
  }, [listTab, filterStatus, sort, q]);

  useEffect(() => {
    load();
  }, [load, dataEpoch]);

  const openNew = () => {
    setEditing(null);
    setTitle("");
    setDetail("");
    setClassification("");
    setWorkload(2);
    setDue("");
    setStatus("todo");
    setOpen(true);
  };

  const openEdit = (t: TaskDTO) => {
    setEditing(t);
    setTitle(t.title);
    setDetail(t.detail);
    setClassification(t.classification ?? "");
    setWorkload(t.expectedWorkload as WorkloadLevel);
    setDue(toLocalInput(t.dueDate));
    setStatus(t.status);
    setOpen(true);
  };

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const body = {
        title: title.trim(),
        detail: detail.trim(),
        classification: classification.trim() || "",
        expectedWorkload: workload,
        dueDate: due ? new Date(due).toISOString() : null,
        status,
      };
      if (editing) {
        await fetch(`/api/tasks/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      setOpen(false);
      bump();
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("이 항목을 삭제할까요? 캘린더에 연결된 일정도 함께 제거됩니다.")) {
      return;
    }
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    bump();
    await load();
  };

  const markDone = async (t: TaskDTO) => {
    await fetch(`/api/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    bump();
    await load();
  };

  const reopen = async (t: TaskDTO) => {
    await fetch(`/api/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "todo" }),
    });
    bump();
    await load();
  };

  const filteredLabel = useMemo(() => {
    if (listTab === "active") return "진행 중 · 미완료 작업";
    if (listTab === "done") return "완료됨 · 처리된 작업만";
    const parts: string[] = [];
    if (filterStatus !== "all") parts.push(filterStatus.replace("_", " "));
    parts.push(`sort: ${sort}`);
    return parts.join(" · ") || "전체";
  }, [listTab, filterStatus, sort]);

  const emptyMessage =
    listTab === "done"
      ? "완료된 작업이 없습니다."
      : listTab === "active"
        ? "진행 중인 작업이 없습니다. 새 작업을 추가해 보세요."
        : "조건에 맞는 작업이 없습니다.";

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">To-Do</h1>
          <p className="mt-1 text-sm text-neutral-500">{filteredLabel}</p>
          <p className="mt-0.5 text-xs text-neutral-400">
            마감일 없는 작업은 Long-Term에만 보여요.
          </p>
        </div>
        <Button onClick={openNew} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" />
          New task
        </Button>
      </header>

      <div className="flex flex-wrap gap-1 rounded-2xl border border-neutral-200/80 bg-white/70 p-1 dark:border-neutral-800 dark:bg-neutral-900/50">
        {(
          [
            { id: "active" as const, label: "진행 중" },
            { id: "done" as const, label: "완료" },
            { id: "all" as const, label: "전체" },
          ] as const
        ).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setListTab(id)}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium transition",
              listTab === id
                ? "bg-neutral-900 text-white shadow-sm dark:bg-neutral-100 dark:text-neutral-900"
                : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          placeholder="제목·내용 검색…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-md"
        />
        {listTab === "all" ? (
          <select
            className="h-10 rounded-2xl border border-neutral-200/90 bg-white/80 px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900/50"
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as TaskStatus | "all")
            }
          >
            <option value="all">모든 상태</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s === "done"
                  ? "완료"
                  : s === "in_progress"
                    ? "진행 중"
                    : "할 일"}
              </option>
            ))}
          </select>
        ) : null}
        <select
          className="h-10 rounded-2xl border border-neutral-200/90 bg-white/80 px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900/50"
          value={sort}
          onChange={(e) =>
            setSort(e.target.value as "due" | "updated" | "created" | "workload")
          }
        >
          <option value="due">마감일 순</option>
          <option value="updated">최근 수정 순</option>
          <option value="created">생성일 순</option>
          <option value="workload">워크로드 순</option>
        </select>
        <Button variant="secondary" size="sm" onClick={() => load()}>
          새로고침
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">불러오는 중…</p>
      ) : tasks.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-neutral-300/90 bg-white/50 py-20 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900/40">
          {emptyMessage}
        </div>
      ) : (
        <ul className="space-y-3">
          {tasks.map((t) => {
            const w = t.expectedWorkload as WorkloadLevel;
            const v = workloadVisual[w];
            return (
              <li
                key={t.id}
                className={cn(
                  "flex flex-col gap-3 rounded-2xl border bg-white/90 p-5 shadow-sm transition-shadow dark:bg-neutral-900/70 sm:flex-row sm:items-start sm:justify-between",
                  v.border,
                  t.status === "done" && "opacity-90",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn("h-2 w-2 shrink-0 rounded-full", v.dot)}
                    />
                    <h2
                      className={cn(
                        "truncate font-semibold text-neutral-900 dark:text-neutral-50",
                        t.status === "done" && "line-through decoration-neutral-400",
                      )}
                    >
                      {t.title}
                    </h2>
                  </div>
                  {t.detail ? (
                    <p className="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                      {t.detail}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-400">
                    <span className="rounded-lg bg-neutral-100 px-2 py-0.5 dark:bg-neutral-800">
                      {t.status === "done"
                        ? "완료"
                        : t.status === "in_progress"
                          ? "진행 중"
                          : "할 일"}
                    </span>
                    <span
                      className={cn(
                        "rounded-lg px-2 py-0.5 text-xs font-semibold",
                        v.bg,
                        w === 1 && "text-emerald-900",
                        w === 2 && "text-blue-900",
                        w === 3 && "text-red-900",
                      )}
                    >
                      WL {t.expectedWorkload}
                    </span>
                    {t.dueDate ? (
                      <span>마감 {format(new Date(t.dueDate), "MMM d, yyyy")}</span>
                    ) : (
                      <span>마감 없음</span>
                    )}
                    {t.status === "done" ? (
                      <span>
                        완료 처리{" "}
                        {format(new Date(t.updatedAt), "MMM d, HH:mm")}
                      </span>
                    ) : null}
                    {t.classification?.trim() ? (
                      <span className="rounded-lg border border-neutral-200/80 bg-neutral-50 px-2 py-0.5 dark:border-neutral-700 dark:bg-neutral-800/80">
                        {t.classification}
                      </span>
                    ) : null}
                    {t.linkedEventId ? (
                      <span className="text-neutral-500">캘린더 연동</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1 sm:flex-col">
                  {t.status !== "done" ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="완료 처리"
                      onClick={() => markDone(t)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="다시 진행 중으로"
                      onClick={() => reopen(t)}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    title="수정"
                    onClick={() => openEdit(t)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="삭제"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                    onClick={() => remove(t.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "작업 수정" : "새 작업"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 pt-2">
            <div className="grid gap-2">
              <Label htmlFor="t-title">제목</Label>
              <Input
                id="t-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="무엇을 해야 하나요?"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="t-detail">상세</Label>
              <Textarea
                id="t-detail"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="메모, 링크…"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="t-class">Classification (선택)</Label>
              <Input
                id="t-class"
                value={classification}
                onChange={(e) => setClassification(e.target.value)}
                placeholder="Long-Term용 분류 (예: 독서) — 마감 비우면 그쪽 전용"
                maxLength={120}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
              <div className="grid gap-2">
                <Label htmlFor="t-wl">워크로드</Label>
                <select
                  id="t-wl"
                  className="h-10 rounded-2xl border border-neutral-200/90 bg-white/80 px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900/50"
                  value={workload}
                  onChange={(e) =>
                    setWorkload(Number(e.target.value) as WorkloadLevel)
                  }
                >
                  <option value={1}>1 — Weakest (green)</option>
                  <option value={2}>2 — Medium (blue)</option>
                  <option value={3}>3 — Hardest (red)</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="t-status">상태</Label>
                <select
                  id="t-status"
                  className="h-10 rounded-2xl border border-neutral-200/90 bg-white/80 px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900/50"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s === "done"
                        ? "완료"
                        : s === "in_progress"
                          ? "진행 중"
                          : "할 일"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="t-due">마감 (선택)</Label>
              <Input
                id="t-due"
                type="datetime-local"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                취소
              </Button>
              <Button onClick={save} disabled={saving || !title.trim()}>
                {saving ? "저장 중…" : "저장"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
