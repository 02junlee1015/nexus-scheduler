"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setPending(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const raw = await r.text();
      let j: { error?: string } = {};
      if (raw) {
        try {
          j = JSON.parse(raw) as { error?: string };
        } catch {
          setErr(`Server error (${r.status}). Response was not JSON.`);
          return;
        }
      } else if (!r.ok) {
        setErr(`Request failed (${r.status}). Empty response.`);
        return;
      }
      if (!r.ok) {
        setErr(j.error ?? "Login failed");
        return;
      }
      router.push(from.startsWith("/") ? from : "/dashboard");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-3xl border border-neutral-200/80 bg-white/90 p-8 shadow-xl dark:border-neutral-800 dark:bg-neutral-900/90">
      <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-neutral-500">Nexus Scheduler</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {err ? (
          <p className="text-sm text-red-600 dark:text-red-400">{err}</p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "…" : "Continue"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-neutral-500">
        No account?{" "}
        <Link
          href="/register"
          className="font-medium text-neutral-800 underline dark:text-neutral-200"
        >
          Register
        </Link>
      </p>
    </div>
  );
}
