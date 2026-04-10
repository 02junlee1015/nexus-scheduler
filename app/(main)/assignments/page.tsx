import { Suspense } from "react";
import { AssignmentsClient } from "@/components/assignments/assignments-client";

function Fallback() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse space-y-6 py-8">
      <div className="h-10 w-48 rounded-xl bg-neutral-200/70 dark:bg-neutral-800" />
      <div className="h-10 w-full max-w-md rounded-full bg-neutral-200/50 dark:bg-neutral-800/80" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 rounded-2xl bg-neutral-200/60 dark:bg-neutral-800/80"
          />
        ))}
      </div>
    </div>
  );
}

export default function AssignmentsPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <AssignmentsClient />
    </Suspense>
  );
}
