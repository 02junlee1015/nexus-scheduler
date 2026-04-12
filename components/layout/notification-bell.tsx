"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { useAppStore } from "@/lib/store/app-store";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  relatedEntityType: string;
  relatedEntityId: string;
  isRead: boolean;
  createdAt: string;
};

export function NotificationBell() {
  const bump = useAppStore((s) => s.bumpDataEpoch);
  const dataEpoch = useAppStore((s) => s.dataEpoch);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/notifications");
    if (!r.ok) return;
    const j = (await r.json()) as {
      items: NotificationRow[];
      unreadCount: number;
    };
    setItems(j.items ?? []);
    setUnread(j.unreadCount ?? 0);
  }, []);

  useEffect(() => {
    void load();
  }, [load, dataEpoch, open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    bump();
    void load();
  }

  async function markAll() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    bump();
    void load();
  }

  function hrefFor(n: NotificationRow): string | null {
    if (
      n.relatedEntityType === "assigned_task_request" &&
      n.relatedEntityId
    ) {
      return `/tasks/${n.relatedEntityId}`;
    }
    if (n.relatedEntityType === "friendship" && n.relatedEntityId) {
      return "/friends";
    }
    return null;
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative rounded-2xl"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 opacity-80" strokeWidth={1.75} />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Button>
      {open ? (
        <div
          className={cn(
            "absolute right-0 z-[60] mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-2xl border border-neutral-200/90 bg-white/95 shadow-xl backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/95",
          )}
        >
          <div className="flex items-center justify-between border-b border-neutral-200/80 px-4 py-2 dark:border-neutral-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Notifications
            </span>
            {unread > 0 ? (
              <button
                type="button"
                className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                onClick={() => void markAll()}
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-neutral-500">
                No notifications yet.
              </li>
            ) : (
              items.map((n) => {
                const href = hrefFor(n);
                const inner = (
                  <div
                    className={cn(
                      "border-b border-neutral-100 px-4 py-3 text-left transition dark:border-neutral-800",
                      !n.isRead && "bg-neutral-50/90 dark:bg-neutral-800/50",
                    )}
                  >
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
                      {n.title}
                    </p>
                    {n.message ? (
                      <p className="mt-0.5 text-xs text-neutral-500 line-clamp-2">
                        {n.message}
                      </p>
                    ) : null}
                  </div>
                );
                return (
                  <li key={n.id}>
                    {href ? (
                      <Link
                        href={href}
                        onClick={() => {
                          if (!n.isRead) void markRead(n.id);
                          setOpen(false);
                        }}
                      >
                        {inner}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="w-full"
                        onClick={() => {
                          if (!n.isRead) void markRead(n.id);
                        }}
                      >
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
