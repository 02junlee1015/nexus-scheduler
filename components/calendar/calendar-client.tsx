"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventInput } from "@fullcalendar/core";
import { useAppStore } from "@/lib/store/app-store";
import type { CalendarEventDTO } from "@/lib/types/api";
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
import { Plus } from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CalendarClient() {
  const bump = useAppStore((s) => s.bumpDataEpoch);
  const dataEpoch = useAppStore((s) => s.dataEpoch);
  const calRef = useRef<FullCalendar>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<CalendarEventDTO | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [workload, setWorkload] = useState<WorkloadLevel>(2);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const api = calRef.current?.getApi();
    api?.refetchEvents();
  }, [dataEpoch]);

  const fetchRange = useCallback(
    async (startStr: string, endStr: string): Promise<EventInput[]> => {
      const r = await fetch(
        `/api/events?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`,
      );
      const raw = (await r.json()) as
        | CalendarEventDTO[]
        | { items: CalendarEventDTO[] };
      const rows = Array.isArray(raw) ? raw : raw.items;
      return rows.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.startDateTime,
        end: e.endDateTime,
        extendedProps: {
          raw: e,
          workload: e.expectedWorkload,
        },
      }));
    },
    [],
  );

  const openDetail = async (id: string) => {
    const r = await fetch(`/api/events/${id}`);
    if (!r.ok) return;
    const e = (await r.json()) as CalendarEventDTO;
    setSelected(e);
    setTitle(e.title);
    setBody(e.detail);
    setWorkload(e.expectedWorkload as WorkloadLevel);
    setStart(toLocalInput(e.startDateTime));
    setEnd(toLocalInput(e.endDateTime));
    setDetailOpen(true);
  };

  const saveEdit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await fetch(`/api/events/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          detail: body.trim(),
          expectedWorkload: workload,
          startDateTime: new Date(start).toISOString(),
          endDateTime: new Date(end).toISOString(),
        }),
      });
      setDetailOpen(false);
      bump();
      calRef.current?.getApi().refetchEvents();
    } finally {
      setSaving(false);
    }
  };

  const deleteEv = async () => {
    if (!selected || !confirm("Remove this calendar block?")) return;
    await fetch(`/api/events/${selected.id}`, { method: "DELETE" });
    setDetailOpen(false);
    bump();
    calRef.current?.getApi().refetchEvents();
  };

  const saveNew = async () => {
    if (!title.trim() || !start) return;
    setSaving(true);
    try {
      const s = new Date(start);
      const e = end ? new Date(end) : undefined;
      await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          detail: body.trim(),
          expectedWorkload: workload,
          startDateTime: s.toISOString(),
          endDateTime: e?.toISOString(),
        }),
      });
      setCreateOpen(false);
      setTitle("");
      setBody("");
      setWorkload(2);
      setStart("");
      setEnd("");
      bump();
      calRef.current?.getApi().refetchEvents();
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => {
    setTitle("");
    setBody("");
    setWorkload(2);
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const endGuess = new Date(now);
    endGuess.setHours(endGuess.getHours() + 1);
    setStart(toLocalInput(now.toISOString()));
    setEnd(toLocalInput(endGuess.toISOString()));
    setCreateOpen(true);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Month, week, and agenda. Workload tints stay consistent with To-Do.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New event
        </Button>
      </header>

      <Tabs.Root defaultValue="cal" className="w-full">
        <Tabs.List className="mb-4 flex w-fit gap-1 rounded-2xl border border-neutral-200/80 bg-white/80 p-1 dark:border-neutral-800 dark:bg-neutral-900/60">
          <Tabs.Trigger
            value="cal"
            className="rounded-xl px-4 py-2 text-sm font-medium text-neutral-500 transition data-[state=active]:bg-neutral-900 data-[state=active]:text-white dark:data-[state=active]:bg-neutral-100 dark:data-[state=active]:text-neutral-900"
          >
            Planner
          </Tabs.Trigger>
          <Tabs.Trigger
            value="hint"
            className="rounded-xl px-4 py-2 text-sm font-medium text-neutral-500 transition data-[state=active]:bg-neutral-900 data-[state=active]:text-white dark:data-[state=active]:bg-neutral-100 dark:data-[state=active]:text-neutral-900"
          >
            Legend
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="cal">
          <div className="rounded-3xl border border-neutral-200/80 bg-white/90 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/50">
            <FullCalendar
              ref={calRef}
              plugins={[
                dayGridPlugin,
                timeGridPlugin,
                listPlugin,
                interactionPlugin,
              ]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,listWeek",
              }}
              height="auto"
              dayMaxEvents
              events={async (info, successCallback, failureCallback) => {
                try {
                  const evs = await fetchRange(info.startStr, info.endStr);
                  successCallback(evs);
                } catch (e) {
                  failureCallback(e as Error);
                }
              }}
              eventClick={(arg) => {
                const id = arg.event.id;
                if (id) void openDetail(id);
              }}
              eventDidMount={(info) => {
                const w = (info.event.extendedProps.workload ?? 2) as WorkloadLevel;
                const c = workloadVisual[w];
                const el = info.el as HTMLElement;
                el.style.backgroundColor = c.fcBg;
                el.style.borderColor = c.fcBorder;
                el.style.color = c.fcText;
                el.style.fontWeight = "500";
                el.style.borderWidth = "1px";
                el.style.borderStyle = "solid";
              }}
            />
          </div>
        </Tabs.Content>
        <Tabs.Content value="hint">
          <div className="rounded-3xl border border-neutral-200/80 bg-white/80 p-6 text-sm dark:border-neutral-800 dark:bg-neutral-900/50">
            <ul className="space-y-3">
              {([1, 2, 3] as const).map((lvl) => {
                const v = workloadVisual[lvl];
                return (
                  <li key={lvl} className="flex items-center gap-3">
                    <span
                      className="h-4 w-4 rounded-md border"
                      style={{
                        backgroundColor: v.fcBg,
                        borderColor: v.fcBorder,
                      }}
                    />
                    <span className="text-neutral-700 dark:text-neutral-200">
                      {lvl === 1 && "Green · "}
                      {lvl === 2 && "Blue · "}
                      {lvl === 3 && "Red · "}
                      Level {lvl} — {v.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </Tabs.Content>
      </Tabs.Root>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Event</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 pt-2">
            <div className="grid gap-2">
              <Label htmlFor="e-title">Title</Label>
              <Input
                id="e-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="e-body">Detail</Label>
              <Textarea
                id="e-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="e-wl">Workload</Label>
              <select
                id="e-wl"
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
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="e-start">Start</Label>
                <Input
                  id="e-start"
                  type="datetime-local"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="e-end">End</Label>
                <Input
                  id="e-end"
                  type="datetime-local"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
            </div>
            {selected?.linkedTaskId ? (
              <p className="text-xs text-neutral-500">
                Linked to to-do · changes sync both ways.
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button variant="destructive" onClick={() => void deleteEv()}>
                Delete
              </Button>
              <Button variant="secondary" onClick={() => setDetailOpen(false)}>
                Close
              </Button>
              <Button onClick={() => void saveEdit()} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New event</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 pt-2">
            <div className="grid gap-2">
              <Label htmlFor="n-title">Title</Label>
              <Input
                id="n-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Team review"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="n-body">Detail</Label>
              <Textarea
                id="n-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="n-wl">Workload</Label>
              <select
                id="n-wl"
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
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="n-start">Start</Label>
                <Input
                  id="n-start"
                  type="datetime-local"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="n-end">End</Label>
                <Input
                  id="n-end"
                  type="datetime-local"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void saveNew()} disabled={saving}>
                {saving ? "Creating…" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
