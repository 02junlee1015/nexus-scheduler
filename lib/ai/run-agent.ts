import OpenAI from "openai";
import { schedulerTools } from "@/lib/ai/tool-definitions";
import { executeSchedulerTool } from "@/lib/ai/execute-tools";
import {
  DEFAULT_MODEL,
  getAIEnvStatus,
  MAX_AGENT_STEPS,
  MAX_TOOL_RESULT_CHARS,
  OPENAI_TIMEOUT_MS,
} from "@/lib/ai/config";

function buildSystemPrompt(): string {
  const now = new Date();
  const utcDate = now.toISOString().slice(0, 10);
  const utcDateTime = now.toISOString();

  return `You are the scheduling copilot for Nexus Scheduler: one app for to-dos and a shared calendar. Data is stored in a real database; tools are the only way to read or change it.

## Rules
- You MUST call tools to create, update, delete, or list tasks/events. Never say you changed data without a successful tool call.
- After tools succeed, answer in the same language the user used (Korean or English). Be brief and concrete: what changed, titles, dates.
- Task and event IDs are opaque strings. If the user refers to something by title, call queryTasks or queryEvents first, pick the best match, then use that id in update/delete.
- Dates: use ISO 8601 in tool arguments. Today (UTC date) is ${utcDate}; full UTC now is ${utcDateTime}. For "tomorrow", "next Monday", etc., compute from this reference. If the user implies local time without timezone, assume their local intent and pick a reasonable ISO time (e.g. 15:00 local as a concrete UTC offset only if you must—prefer full ISO with Z or offset when possible).
- Workload: 1 = weakest (green), 2 = medium (blue), 3 = hardest (red).
- "This week": queryTasks with dueAfter = start of today (UTC) and dueBefore = 7 days later unless the user specifies otherwise.
- Mark done: updateTask with status "done". Reopen: status "todo" or "in_progress".
- Time-specific moves: updateEvent with startDateTime/endDateTime. Day-level deadline only: updateTask dueDate.
- If a tool returns an error JSON, explain it briefly and suggest a fix; do not pretend success.

## Collaboration
- Friends: sendFriendRequest (email), acceptFriendRequest (friendshipId), listFriends.
- Shared tasks (Tasks in the app): assignTaskToFriend (recipientEmail + task fields), listAssignedTasks, acceptAssignedTask, requestAssignmentAdjustment, reviseAssignedTask, cancelAssignedTask, declineAssignedTask.
- Notifications: listNotifications. Use listFriends / listAssignedTasks to obtain ids before accept or respond.
- All task/event queries and mutations are scoped to the signed-in user only.

## Tools summary
createTask, updateTask, deleteTask, createEvent, updateEvent, deleteEvent, queryTasks, queryEvents, syncTaskAndCalendar, sendFriendRequest, acceptFriendRequest, listFriends, assignTaskToFriend, listAssignedTasks, acceptAssignedTask, requestAssignmentAdjustment, reviseAssignedTask, cancelAssignedTask, declineAssignedTask, listNotifications.`;
}

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type AgentRunMeta = {
  configured: boolean;
  model: string | null;
  finishReason?: string;
};

export type AgentRunResult = {
  reply: string;
  toolCallsApplied: number;
  meta: AgentRunMeta;
};

function truncateToolPayload(json: string): string {
  if (json.length <= MAX_TOOL_RESULT_CHARS) return json;
  return JSON.stringify({
    _truncated: true,
    _note: `Result was truncated (${json.length} chars). Summarize from this preview or call query again with a stricter filter.`,
    preview: json.slice(0, MAX_TOOL_RESULT_CHARS - 400),
  });
}

export type AgentRunOptions = {
  userId: string;
};

export async function runSchedulerAgent(
  messages: ChatMessage[],
  opts: AgentRunOptions,
): Promise<AgentRunResult> {
  const env = getAIEnvStatus();
  const meta: AgentRunMeta = {
    configured: env.ready,
    model: env.ready ? env.model : null,
  };

  if (!env.ready) {
    const hint =
      env.reason === "invalid_key_format"
        ? "OPENAI_API_KEY가 sk- 로 시작하지 않습니다. 키를 확인하세요."
        : "OPENAI_API_KEY가 설정되지 않았습니다. 프로젝트 루트의 .env 파일에 키를 넣고 서버를 다시 시작하세요.";
    return {
      reply: `AI 어시스턴트를 쓰려면 OpenAI API 키가 필요합니다.\n\n${hint}\n\n모델은 환경변수 OPENAI_MODEL로 바꿀 수 있습니다 (기본: ${DEFAULT_MODEL}).`,
      toolCallsApplied: 0,
      meta,
    };
  }

  const baseURL = process.env.OPENAI_BASE_URL?.trim() || undefined;

  const client = new OpenAI({
    apiKey: env.apiKey,
    baseURL,
    timeout: OPENAI_TIMEOUT_MS,
    maxRetries: 2,
  });

  const mapped: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
    messages.map((m) => {
      if (m.role === "system")
        return { role: "system" as const, content: m.content };
      if (m.role === "user")
        return { role: "user" as const, content: m.content };
      return { role: "assistant" as const, content: m.content };
    });

  const convo: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt() },
    ...mapped,
  ];

  let toolCallsApplied = 0;

  for (let step = 0; step < MAX_AGENT_STEPS; step++) {
    let res: OpenAI.Chat.Completions.ChatCompletion;
    try {
      res = await client.chat.completions.create({
        model: env.model,
        messages: convo,
        tools:
          schedulerTools as unknown as OpenAI.Chat.Completions.ChatCompletionTool[],
        tool_choice: "auto",
        temperature: 0.15,
      });
    } catch (e: unknown) {
      const err = e as { status?: number; message?: string; code?: string };
      const msg =
        err?.message ??
        (e instanceof Error ? e.message : "OpenAI request failed");
      if (err?.status === 401) {
        return {
          reply:
            "OpenAI API 인증에 실패했습니다. API 키가 맞는지, 결제/쿼터가 활성인지 확인해 주세요.",
          toolCallsApplied,
          meta: { ...meta, finishReason: "auth_error" },
        };
      }
      if (err?.status === 429) {
        return {
          reply:
            "OpenAI 쪽 요청 한도(429)에 걸렸어요. 키 설정은 된 상태일 수 있고, 계정의 분당·일당 제한 문제예요.\n\n" +
            "· 1~2분 뒤에 다시 보내 보기\n" +
            "· platform.openai.com → Usage / Limits에서 한도·쿼터 확인\n" +
            "· 새 계정·무료 티어는 RPM이 낮을 수 있음 (결제 연동 시 완화되는 경우 많음)\n" +
            "· 한 번에 짧게 한 가지만 물어보기",
          toolCallsApplied,
          meta: { ...meta, finishReason: "rate_limit" },
        };
      }
      return {
        reply: `AI 요청 중 오류가 났습니다: ${msg}`,
        toolCallsApplied,
        meta: { ...meta, finishReason: "openai_error" },
      };
    }

    const choice = res.choices[0]?.message;
    meta.finishReason = res.choices[0]?.finish_reason ?? undefined;

    if (!choice) {
      return {
        reply: "응답이 비어 있습니다. 다시 시도해 주세요.",
        toolCallsApplied,
        meta,
      };
    }

    const toolCalls = choice.tool_calls;
    if (!toolCalls?.length) {
      const text = choice.content?.trim() || "완료했습니다.";
      return { reply: text, toolCallsApplied, meta };
    }

    convo.push({
      role: "assistant",
      content: choice.content,
      tool_calls: toolCalls,
    });

    for (const call of toolCalls) {
      if (call.type !== "function") continue;
      let args: unknown = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        args = {};
      }
      const out = await executeSchedulerTool(call.function.name, args, {
        userId: opts.userId,
      });
      toolCallsApplied++;
      const payload = out.ok ? out.result : { error: out.error };
      let asJson = JSON.stringify(payload);
      asJson = truncateToolPayload(asJson);
      convo.push({
        role: "tool",
        tool_call_id: call.id,
        content: asJson,
      });
    }
  }

  return {
    reply:
      "도구 호출이 많아 여기서 멈췄습니다. 할 일·캘린더를 직접 확인해 주세요.",
    toolCallsApplied,
    meta: { ...meta, finishReason: "max_steps" },
  };
}
