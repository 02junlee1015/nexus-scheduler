import { Suspense } from "react";
import { TodoClient } from "@/components/todo/todo-client";

function TodoFallback() {
  return (
    <div className="mx-auto max-w-4xl py-12 text-sm text-neutral-500">
      불러오는 중…
    </div>
  );
}

export default function TodoPage() {
  return (
    <Suspense fallback={<TodoFallback />}>
      <TodoClient />
    </Suspense>
  );
}
