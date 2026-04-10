"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/lib/store/app-store";
import type { TaskDTO, TaskStatus } from "@/lib/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";
import { Trash2, CheckCircle2, RotateCcw, Pencil, Check, X } from "lucide-react";

type ListTab = "active" | "done" | "all";

export function FlexibleClient() {
  const bump = useAppStore((s) => s.bumpDataEpoch);
  const dataEpoch = useAppStore((s) => s.dataEpoch);
  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [listTab, setListTab] = useState<ListTab>("active");
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");
  const [q, setQ] = useState("");

  const [composerClass, setComposerClass] = useState("");
  const [composerTitle, setComposerTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const composerTitleRef = useRef<HTMLInputElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftClass, setDraftClass] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDetail, setDraftDetail] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("flex", "1");
    if (listTab === "active") params.set("scope", "active");
    if (listTab === "done") params.set("scope", "done");
    if (listTab === "all" && filterStatus !== "all") {
      params.set("status", filterStatus);
    }
    params.set("sort", "updated");
    params.set("limit", "300");
    if (q.trim()) params.set("q", q.trim());

    const r = await fetch(`/api/tasks?${params}`);
    const data = (await r.json()) as { items: TaskDTO[] };
    setTasks(data.items ?? []);
    setLoading(false);
  }, [listTab, filterStatus, q]);

  useEffect(() => {
    void load();
  }, [load, dataEpoch]);

  const submitNew = async () => {
    const title = composerTitle.trim();
    if (!title || adding) return;
    setAdding(true);
    try {
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          detail: "",
          classification: composerClass.trim() || "",
          dueDate: null,
          status: "todo",
        }),
      });
      if (!r.ok) return;
      setComposerClass("");
      setComposerTitle("");
      bump();
      await load();
      composerTitleRef.current?.focus();
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (t: TaskDTO) => {
    setEditingId(t.id);
    setDraftClass(t.classification ?? "");
    setDraftTitle(t.title);
    setDraftDetail(t.detail ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftClass("");
    setDraftTitle("");
    setDraftDetail("");
  };

  const saveEdit = async () => {
    if (!editingId || !draftTitle.trim() || savingEdit) return;
    setSavingEdit(true);
    try {
      const r = await fetch(`/api/tasks/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draftTitle.trim(),
          detail: draftDetail.trim(),
          classification: draftClass.trim() || "",
        }),
      });
      if (!r.ok) return;
      cancelEdit();
      bump();
      await load();
    } finally {
      setSavingEdit(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("삭제할까요?")) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (editingId === id) cancelEdit();
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

  const subtitle = useMemo(() => {
    if (listTab === "active") return "마감 없음 · 진행 중";
    if (listTab === "done") return "마감 없음 · 완료";
    return "마감 없음 · 전체";
  }, [listTab]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Long-Term</h1>
        <p className="text-sm text-neutral-500">
          마감 없이 두고 가도 되는 일 · To-Do 목록에는 안 나와요 · {subtitle}
        </p>
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
          placeholder="분류·제목·내용 검색…"
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
            <option value="todo">할 일</option>
            <option value="in_progress">진행 중</option>
            <option value="done">완료</option>
          </select>
        ) : null}
        <Button variant="secondary" size="sm" onClick={() => void load()}>
          새로고침
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white/90 dark:border-neutral-800 dark:bg-neutral-900/60">
        <div className="grid grid-cols-1 gap-0 border-b border-neutral-200/80 bg-neutral-50/90 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/80 sm:grid-cols-[minmax(7rem,0.9fr)_1fr_auto] sm:items-center">
          <div className="hidden sm:block">Classification</div>
          <div className="sm:col-span-1">내용</div>
          <div className="hidden w-[7.5rem] shrink-0 sm:block" aria-hidden />
        </div>

        {/* 인라인 입력 — 엔터로 추가 (내용 칸에서) */}
        <div className="border-b border-dashed border-neutral-200/90 bg-neutral-50/40 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/40">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(7rem,0.9fr)_1fr_auto] sm:items-start">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-neutral-500 sm:hidden">
                Classification
              </label>
              <Input
                value={composerClass}
                onChange={(e) => setComposerClass(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    composerTitleRef.current?.focus();
                  }
                }}
                placeholder="분류"
                maxLength={120}
                disabled={adding}
                className="bg-white/90 dark:bg-neutral-950/50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-neutral-500 sm:hidden">
                내용
              </label>
              <Input
                ref={composerTitleRef}
                value={composerTitle}
                onChange={(e) => setComposerTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void submitNew();
                  }
                }}
                placeholder="할 일 — 입력 후 엔터"
                disabled={adding}
                className="bg-white/90 dark:bg-neutral-950/50"
              />
              <p className="mt-1.5 text-[11px] text-neutral-400">
                분류는 비워도 됩니다 · 상세 메모는 줄에서 수정으로
              </p>
            </div>
            <div className="flex items-end justify-end sm:w-[7.5rem] sm:shrink-0">
              <span className="text-[11px] text-neutral-400 tabular-nums sm:text-right">
                {adding ? "추가 중…" : "↵ 추가"}
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="px-4 py-10 text-center text-sm text-neutral-500">
            불러오는 중…
          </p>
        ) : tasks.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-neutral-500">
            위 칸에 내용 입력 후 엔터를 누르면 추가돼요.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200/80 dark:divide-neutral-800">
            {tasks.map((t) => {
              const isEditing = editingId === t.id;
              return (
                <li
                  key={t.id}
                  className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-[minmax(6rem,0.85fr)_1fr_auto] sm:items-start"
                >
                  <div className="min-w-0">
                    {isEditing ? (
                      <Input
                        value={draftClass}
                        onChange={(e) => setDraftClass(e.target.value)}
                        placeholder="분류"
                        maxLength={120}
                        className="bg-white/90 dark:bg-neutral-950/50"
                      />
                    ) : t.classification?.trim() ? (
                      <span className="text-sm font-medium text-neutral-800 dark:text-neutral-100">
                        {t.classification}
                      </span>
                    ) : (
                      <span className="text-sm text-neutral-400 dark:text-neutral-500">
                        미분류
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    {isEditing ? (
                      <div className="space-y-2">
                        <Input
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          placeholder="제목"
                          className="bg-white/90 dark:bg-neutral-950/50"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              void saveEdit();
                            }
                          }}
                        />
                        <Textarea
                          value={draftDetail}
                          onChange={(e) => setDraftDetail(e.target.value)}
                          placeholder="상세 (선택)"
                          rows={3}
                          className="resize-y rounded-2xl border border-neutral-200/90 bg-white/90 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950/50"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                              e.preventDefault();
                              void saveEdit();
                            }
                          }}
                        />
                        <p className="text-[11px] text-neutral-400">
                          제목 칸에서 엔터 또는 ⌘/Ctrl+Enter(상세)로 저장
                        </p>
                      </div>
                    ) : (
                      <>
                        <p
                          className={cn(
                            "font-semibold text-neutral-900 dark:text-neutral-50",
                            t.status === "done" &&
                              "text-neutral-500 line-through decoration-neutral-400 dark:text-neutral-400",
                          )}
                        >
                          {t.title}
                        </p>
                        {t.detail ? (
                          <p className="mt-1 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                            {t.detail}
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap justify-end gap-1 sm:w-[7.5rem] sm:flex-col sm:items-end">
                    {isEditing ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="저장"
                          disabled={savingEdit || !draftTitle.trim()}
                          onClick={() => void saveEdit()}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="취소"
                          disabled={savingEdit}
                          onClick={cancelEdit}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        {t.status !== "done" ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="완료"
                            onClick={() => void markDone(t)}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="되돌리기"
                            onClick={() => void reopen(t)}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          title="수정"
                          onClick={() => startEdit(t)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                          title="삭제"
                          onClick={() => void remove(t.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-xs text-neutral-400">
        마감일을 넣으면{" "}
        <a href="/todo" className="underline underline-offset-2">
          To-Do
        </a>
        ·{" "}
        <a href="/calendar" className="underline underline-offset-2">
          Calendar
        </a>
        에서 다루는 일정으로 이어질 수 있어요.
      </p>
    </div>
  );
}
