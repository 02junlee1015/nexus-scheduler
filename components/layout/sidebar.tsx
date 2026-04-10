"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListTodo,
  CalendarDays,
  Layers,
  UsersRound,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/todo", label: "To-Do", icon: ListTodo },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/flex", label: "Long-Term", icon: Layers },
  { href: "/friends", label: "Friends", icon: UsersRound },
  { href: "/assignments", label: "Assignments", icon: Inbox },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-neutral-200/70 bg-white/70 px-4 py-8 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/60">
      <div className="mb-10 px-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
          Scheduler
        </p>
        <h1 className="mt-1 text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Nexus
        </h1>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-neutral-900 text-white shadow-sm dark:bg-neutral-100 dark:text-neutral-900"
                  : "text-neutral-600 hover:bg-neutral-100/90 dark:text-neutral-400 dark:hover:bg-neutral-800/80",
              )}
            >
              <Icon className="h-4 w-4 opacity-80" strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>
      <p className="mt-auto px-2 text-[11px] leading-relaxed text-neutral-400">
        One surface for tasks, time, and intent.
      </p>
    </aside>
  );
}
