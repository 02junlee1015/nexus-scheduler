import { Sidebar } from "@/components/layout/sidebar";
import { SchedulerChat } from "@/components/ai/scheduler-chat";
import { NotificationBell } from "@/components/layout/notification-bell";
import { UserMenu } from "@/components/layout/user-menu";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#f5f5f4] text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <Sidebar />
      <div className="relative flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-end gap-1 border-b border-neutral-200/60 bg-white/60 px-6 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/50">
          <NotificationBell />
          <UserMenu />
        </header>
        <main className="flex-1 overflow-auto px-8 py-10 pb-32">{children}</main>
        <SchedulerChat />
      </div>
    </div>
  );
}
