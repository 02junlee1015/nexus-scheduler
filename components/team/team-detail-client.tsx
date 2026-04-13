"use client";

import { memo, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import luxonPlugin from "@fullcalendar/luxon3";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import type { EventInput } from "@fullcalendar/core";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { APP_TIME_ZONE } from "@/lib/constants/timezone";
import type { TaskDTO } from "@/lib/types/api";

type TeamSummary = {
  id: string;
  name: string;
  ownerUserId: string;
  members: { userId: string; email: string; name: string }[];
};

type MemberOverview = {
  userId: string;
  email: string;
  name: string;
  nextTasks: TaskDTO[];
  recentDone: TaskDTO[];
};

type CalendarRow = {
  id: string;
  title: string;
  startDateTime: string;
  endDateTime: string;
  expectedWorkload: number;
  linkedTaskStatus: string | null;
  memberUserId: string;
  memberName: string;
};

function memberColor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++)
    h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 48% 44%)`;
}

function formatDue(iso: string | null) {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "MMM d, HH:mm");
  } catch {
    return "—";
  }
}

function formatEventSpan(e: CalendarRow) {
  try {
    const s = new Date(e.startDateTime);
    const end = new Date(e.endDateTime);
    return `${format(s, "MMM d, HH:mm")} – ${format(end, "HH:mm")}`;
  } catch {
    return "—";
  }
}

const calendarPlugins = [
  luxonPlugin,
  dayGridPlugin,
  timeGridPlugin,
  listPlugin,
] as const;

const calendarHeader = {
  left: "prev,next today",
  center: "title",
  right: "dayGridMonth,timeGridWeek,listWeek",
} as const;

/** Isolated from parent state so loading events does not re-render FullCalendar (flicker). */
const TeamCalendarPane = memo(function TeamCalendarPane({
  teamId,
  onRangeEvents,
}: {
  teamId: string;
  onRangeEvents: (items: CalendarRow[]) => void;
}) {
  const fetchForCalendar = useCallback(
    async (startStr: string, endStr: string): Promise<EventInput[]> => {
      const r = await fetch(
        `/api/teams/${teamId}/events?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`,
      );
      if (!r.ok) {
        onRangeEvents([]);
        return [];
      }
      const j = (await r.json()) as { items: CalendarRow[] };
      onRangeEvents(j.items);
      return j.items.map((e) => ({
        id: `${e.memberUserId}:${e.id}`,
        title: `${e.memberName}: ${e.title}`,
        start: e.startDateTime,
        end: e.endDateTime,
        backgroundColor: memberColor(e.memberUserId),
        borderColor: memberColor(e.memberUserId),
        classNames:
          e.linkedTaskStatus === "done" ? ["fc-event-completed"] : undefined,
        extendedProps: { raw: e },
      }));
    },
    [teamId, onRangeEvents],
  );

  return (
    <div className="rounded-3xl border border-neutral-200/80 bg-white/90 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
      <FullCalendar
        plugins={[...calendarPlugins]}
        timeZone={APP_TIME_ZONE}
        initialView="dayGridMonth"
        headerToolbar={calendarHeader}
        height="auto"
        dayMaxEvents
        events={async (info, successCallback, failureCallback) => {
          try {
            const evs = await fetchForCalendar(info.startStr, info.endStr);
            successCallback(evs);
          } catch (e) {
            failureCallback(e as Error);
          }
        }}
      />
    </div>
  );
});

export function TeamDetailClient({
  teamId,
  meId,
}: {
  teamId: string;
  meId: string;
}) {
  const router = useRouter();
  const [team, setTeam] = useState<TeamSummary | null>(null);
  const [members, setMembers] = useState<MemberOverview[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [rangeEvents, setRangeEvents] = useState<CalendarRow[]>([]);
  const onRangeEvents = useCallback((items: CalendarRow[]) => {
    setRangeEvents(items);
  }, []);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const r = await fetch(`/api/teams/${teamId}/overview`);
      if (!r.ok) {
        setErr(r.status === 403 ? "Access denied." : "Could not load team.");
        setTeam(null);
        setMembers(null);
        return;
      }
      const j = (await r.json()) as {
        team: TeamSummary;
        members: MemberOverview[];
      };
      setTeam(j.team);
      setMembers(j.members);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function deleteTeam() {
    if (!team || !confirm(`Delete team “${team.name}”?`)) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
      if (!r.ok) return;
      router.push("/team");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl animate-pulse space-y-8 py-8">
        <div className="h-10 w-48 rounded-xl bg-neutral-200/70 dark:bg-neutral-800" />
        <div className="h-64 rounded-3xl bg-neutral-200/50 dark:bg-neutral-800/80" />
      </div>
    );
  }

  if (err || !team || !members) {
    return (
      <div className="mx-auto max-w-4xl py-12 text-center text-sm text-red-600">
        {err ?? "Could not load team."}
      </div>
    );
  }

  const isOwner = team.ownerUserId === meId;

  return (
    <div className="mx-auto max-w-5xl space-y-12 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/team"
            className="text-sm font-medium text-neutral-500 underline dark:text-neutral-400"
          >
            ← All teams
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            {team.name}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {team.members.length} members · each color is one person; member
            panels use the same range as the team calendar
          </p>
        </div>
        {isOwner ? (
          <Button
            type="button"
            variant="outline"
            className="rounded-2xl"
            disabled={deleting}
            onClick={() => void deleteTeam()}
          >
            {deleting ? "…" : "Delete team"}
          </Button>
        ) : null}
      </div>

      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Team calendar
        </h2>
        <TeamCalendarPane teamId={teamId} onRangeEvents={onRangeEvents} />
      </section>

      <section className="space-y-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Members
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          {members.map((m) => {
            const memberCal = rangeEvents
              .filter((e) => e.memberUserId === m.userId)
              .slice()
              .sort(
                (a, b) =>
                  new Date(a.startDateTime).getTime() -
                  new Date(b.startDateTime).getTime(),
              );
            return (
              <div
                key={m.userId}
                className="rounded-3xl border border-neutral-200/80 bg-white/90 p-5 dark:border-neutral-800 dark:bg-neutral-900/60"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: memberColor(m.userId) }}
                  />
                  <h3 className="font-semibold text-neutral-900 dark:text-neutral-50">
                    {m.name?.trim() || m.email}
                  </h3>
                  {m.userId === meId ? (
                    <span className="text-xs text-neutral-400">(you)</span>
                  ) : null}
                </div>
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                      Next up
                    </p>
                    {m.nextTasks.length === 0 ? (
                      <p className="mt-1 text-sm text-neutral-500">
                        Nothing open.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2 text-sm">
                        {m.nextTasks.map((t) => (
                          <li
                            key={t.id}
                            className="flex justify-between gap-2 border-b border-neutral-100 pb-2 dark:border-neutral-800"
                          >
                            <span className="min-w-0 truncate">{t.title}</span>
                            <span className="shrink-0 text-neutral-500">
                              {formatDue(t.dueDate)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                      Calendar (same range as above)
                    </p>
                    {memberCal.length === 0 ? (
                      <p className="mt-1 text-sm text-neutral-500">
                        No events in this range.
                      </p>
                    ) : (
                      <ul className="mt-2 max-h-44 space-y-1.5 overflow-y-auto text-sm text-neutral-700 dark:text-neutral-200">
                        {memberCal.map((e) => (
                          <li
                            key={`${e.memberUserId}:${e.id}`}
                            className="flex justify-between gap-2 border-b border-neutral-100 pb-1.5 dark:border-neutral-800"
                          >
                            <span className="min-w-0 truncate">{e.title}</span>
                            <span className="shrink-0 text-neutral-500">
                              {formatEventSpan(e)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                      Recently done
                    </p>
                    {m.recentDone.length === 0 ? (
                      <p className="mt-1 text-sm text-neutral-500">
                        No completions yet.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1 text-sm text-neutral-600 dark:text-neutral-300">
                        {m.recentDone.map((t) => (
                          <li key={t.id} className="truncate">
                            ✓ {t.title}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
