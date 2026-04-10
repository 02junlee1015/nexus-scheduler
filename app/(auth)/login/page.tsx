import { Suspense } from "react";
import { LoginForm } from "./login-form";

function LoginFallback() {
  return (
    <div className="h-[320px] w-full max-w-md animate-pulse rounded-3xl border border-neutral-200/80 bg-white/60 dark:border-neutral-800 dark:bg-neutral-900/60" />
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
