"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, Send, X, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils/cn";

type Role = "user" | "assistant";

type Msg = { role: Role; content: string };

type AIStatusPayload = {
  ready: boolean;
  model: string | null;
  defaultModel: string;
  reason: "missing_key" | "invalid_key_format" | null;
};

export function SchedulerChat() {
  const bump = useAppStore((s) => s.bumpDataEpoch);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [aiStatus, setAiStatus] = useState<AIStatusPayload | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "일정과 할 일을 자연어로 말해 주세요. 예: \"금요일까지 워크로드 3으로 투자자 메모 추가\", \"내일 오후 3시 팀 미팅 잡아줘\", \"이번 주 마감인 일 보여줘\". 말씀하시면 도구로 실제 데이터를 바꿉니다.",
    },
  ]);
  const [pending, setPending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/ai/status");
      if (r.ok) {
        const j = (await r.json()) as AIStatusPayload;
        setAiStatus(j);
      }
    } catch {
      setAiStatus(null);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (open) void refreshStatus();
  }, [open, refreshStatus]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || pending) return;
    setInput("");
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next);
    setPending(true);
    try {
      const r = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      const data = (await r.json()) as {
        reply?: string;
        error?: unknown;
        toolCallsApplied?: number;
        meta?: { configured?: boolean; model?: string | null };
      };
      if (!r.ok) {
        const errText =
          typeof data.error === "string"
            ? data.error
            : "요청을 처리하지 못했습니다.";
        setMsgs((m) => [
          ...m,
          { role: "assistant", content: errText },
        ]);
        return;
      }
      setMsgs((m) => [
        ...m,
        { role: "assistant", content: data.reply ?? "" },
      ]);
      if ((data.toolCallsApplied ?? 0) > 0) bump();
      if (data.meta?.configured) void refreshStatus();
    } catch {
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content: "네트워크 오류입니다. 잠시 후 다시 시도해 주세요.",
        },
      ]);
    } finally {
      setPending(false);
    }
  };

  const configured = aiStatus?.ready === true;
  const modelLabel = aiStatus?.model ?? aiStatus?.defaultModel ?? "gpt-4o-mini";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-900 text-white shadow-[0_12px_40px_-12px_rgba(0,0,0,0.45)] transition hover:scale-[1.03] active:scale-[0.98] dark:bg-neutral-100 dark:text-neutral-900",
          open && "pointer-events-none opacity-0",
        )}
        aria-label="AI 어시스턴트 열기"
      >
        <MessageSquare className="h-6 w-6" strokeWidth={1.75} />
      </button>

      <div
        className={cn(
          "fixed bottom-6 right-6 z-50 flex w-[min(100vw-2rem,400px)] flex-col overflow-hidden rounded-3xl border border-neutral-200/90 bg-white/95 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.25)] transition-all duration-300 dark:border-neutral-700 dark:bg-neutral-900/95",
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none invisible translate-y-4 opacity-0",
        )}
        style={{ maxHeight: "min(560px, 100vh - 5rem)" }}
      >
        <div className="flex items-center justify-between border-b border-neutral-200/80 px-4 py-3 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900">
              <Sparkles className="h-4 w-4" strokeWidth={2} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                AI 스케줄러
              </p>
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
                {configured ? modelLabel : "설정 필요"}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setOpen(false)}
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {!configured && aiStatus ? (
          <div className="flex items-start gap-2 border-b border-amber-200/80 bg-amber-50/95 px-4 py-2.5 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">OpenAI API 키가 없거나 형식이 맞지 않습니다.</p>
              <p className="mt-1 text-amber-900/90 dark:text-amber-200/90">
                {process.env.NODE_ENV === "production" ? (
                  <>
                    이 사이트 운영자가 Vercel(또는 호스팅) 환경 변수에{" "}
                    <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/60">
                      OPENAI_API_KEY
                    </code>
                    를 설정하면 모든 사용자에게 AI가 동일하게 켜집니다. 선택:{" "}
                    <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/60">
                      OPENAI_MODEL
                    </code>
                  </>
                ) : (
                  <>
                    프로젝트 루트{" "}
                    <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/60">.env</code>에{" "}
                    <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/60">
                      OPENAI_API_KEY=sk-...
                    </code>
                    를 넣고 서버를 재시작하세요. 선택:{" "}
                    <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/60">
                      OPENAI_MODEL
                    </code>
                  </>
                )}
              </p>
            </div>
          </div>
        ) : null}

        {configured ? (
          <p className="border-b border-neutral-100 px-4 py-1.5 text-[10px] text-neutral-400 dark:border-neutral-800">
            모델: {modelLabel} · 도구 호출로 DB를 직접 수정합니다
          </p>
        ) : null}

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-2xl px-3 py-2.5 leading-relaxed",
                  m.role === "user"
                    ? "ml-6 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                    : "mr-4 bg-neutral-100/90 text-neutral-800 dark:bg-neutral-800/80 dark:text-neutral-100",
                )}
              >
                {m.content}
              </div>
            ))}
            {pending ? (
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                처리 중…
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          <div className="border-t border-neutral-200/80 p-3 dark:border-neutral-800">
            <Textarea
              rows={2}
              placeholder="예: 다음 주 월요일로 마케팅 리뷰 옮겨줘"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              className="mb-2 resize-none text-sm"
              disabled={pending}
            />
            <Button
              className="w-full gap-2"
              onClick={() => void send()}
              disabled={pending || !input.trim()}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              보내기
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
