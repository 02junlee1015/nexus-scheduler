"use client";

import dynamic from "next/dynamic";

const CalendarClient = dynamic(
  () =>
    import("@/components/calendar/calendar-client").then((m) => m.CalendarClient),
  { ssr: false, loading: () => <CalendarLoading /> },
);

function CalendarLoading() {
  return (
    <div className="flex h-[70vh] items-center justify-center rounded-3xl border border-dashed border-neutral-300/80 bg-white/50 text-sm text-neutral-500">
      Loading calendar…
    </div>
  );
}

export default function CalendarPage() {
  return <CalendarClient />;
}
