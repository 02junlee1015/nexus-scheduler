"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const friendInvite = searchParams.get("friendInvite");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setPending(true);
    try {
      const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: name || undefined,
          friendInviteToken: friendInvite || undefined,
        }),
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
        setErr(typeof j.error === "string" ? j.error : "Registration failed");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-3xl border border-neutral-200/80 bg-white/90 p-8 shadow-xl dark:border-neutral-800 dark:bg-neutral-900/90">
      <h1 className="text-xl font-semibold tracking-tight">Create account</h1>
      <p className="mt-1 text-sm text-neutral-500">8+ character password</p>
      {friendInvite ? (
        <p className="mt-3 rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
          You’re signing up from a friend invite. Use the email the invitation
          was sent to, then you’ll see their friend request after registering.
        </p>
      ) : null}
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name (optional)</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {err ? (
          <p className="text-sm text-red-600 dark:text-red-400">{err}</p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "…" : "Register"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-neutral-500">
        Have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-neutral-800 underline dark:text-neutral-200"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
