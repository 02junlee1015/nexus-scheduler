import { Suspense } from "react";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-3xl border border-neutral-200/80 bg-white/90 p-8 text-sm text-neutral-500 shadow-xl dark:border-neutral-800 dark:bg-neutral-900/90">
          Loading…
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
