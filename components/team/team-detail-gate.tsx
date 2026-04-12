"use client";

import dynamic from "next/dynamic";

const TeamDetailClient = dynamic(
  () =>
    import("@/components/team/team-detail-client").then(
      (m) => m.TeamDetailClient,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto max-w-4xl animate-pulse space-y-8 py-8">
        <div className="h-10 w-48 rounded-xl bg-neutral-200/70 dark:bg-neutral-800" />
        <div className="h-72 rounded-3xl bg-neutral-200/50 dark:bg-neutral-800/80" />
      </div>
    ),
  },
);

export function TeamDetailGate({
  teamId,
  meId,
}: {
  teamId: string;
  meId: string;
}) {
  return <TeamDetailClient teamId={teamId} meId={meId} />;
}
