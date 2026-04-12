"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store/app-store";

type TeamSummary = {
  id: string;
  name: string;
  ownerUserId: string;
  members: { userId: string; email: string; name: string }[];
};

export function TeamListClient() {
  const dataEpoch = useAppStore((s) => s.dataEpoch);
  const [items, setItems] = useState<TeamSummary[] | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/teams");
    if (!r.ok) return;
    const j = (await r.json()) as { items: TeamSummary[] };
    setItems(j.items);
  }, []);

  useEffect(() => {
    void load();
  }, [load, dataEpoch]);

  if (!items) {
    return (
      <div className="mx-auto max-w-4xl animate-pulse space-y-6 py-8">
        <div className="h-10 w-32 rounded-xl bg-neutral-200/70 dark:bg-neutral-800" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-36 rounded-3xl bg-neutral-200/50 dark:bg-neutral-800/80"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Team
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Teams you belong to. Create new ones from{" "}
          <Link href="/friends" className="font-medium underline">
            Friends
          </Link>
          .
        </p>
      </header>

      {items.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-neutral-300/90 bg-white/40 px-6 py-16 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900/30">
          No teams yet. On Friends, select people and use &quot;Build a team&quot;.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((t) => (
            <li key={t.id}>
              <Link
                href={`/team/${t.id}`}
                className="block rounded-3xl border border-neutral-200/80 bg-white/90 p-6 shadow-sm transition hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900/60 dark:hover:border-neutral-600"
              >
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                  {t.name}
                </h2>
                <p className="mt-2 text-xs font-medium uppercase tracking-wider text-neutral-400">
                  Members ({t.members.length})
                </p>
                <ul className="mt-2 space-y-1 text-sm text-neutral-600 dark:text-neutral-300">
                  {t.members.map((m) => (
                    <li key={m.userId} className="truncate">
                      {m.name?.trim() || m.email}
                    </li>
                  ))}
                </ul>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
