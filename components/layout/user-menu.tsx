"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Me = { id: string; email: string; name: string };

export function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<Me | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/auth/me");
    if (!r.ok) return;
    const j = (await r.json()) as { user: Me | null };
    setUser(j.user);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (!user) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-[10rem] truncate text-xs text-neutral-500 sm:inline">
        {user.name || user.email}
      </span>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="rounded-xl text-xs"
        onClick={() => void logout()}
      >
        Log out
      </Button>
    </div>
  );
}
