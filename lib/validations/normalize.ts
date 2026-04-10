import { parseFlexibleDateTime } from "@/lib/utils/date-parse";
import type {
  CreateEventInput,
  CreateEventPayload,
  CreateTaskPayload,
} from "@/lib/types/api";
import type { z } from "zod";
import type { createEventBody, createTaskBody, patchEventBody, patchTaskBody } from "@/lib/validations/api";

function normDue(
  v: string | null | undefined,
): { ok: true; value: string | null | undefined } | { ok: false; message: string } {
  if (v === undefined) return { ok: true, value: undefined };
  if (v === null) return { ok: true, value: null };
  const t = String(v).trim();
  if (t === "") return { ok: true, value: null };
  try {
    return { ok: true, value: parseFlexibleDateTime(t) };
  } catch {
    return { ok: false, message: `Invalid dueDate: ${v}` };
  }
}

function normReq(s: string, field: string) {
  try {
    return { ok: true as const, value: parseFlexibleDateTime(s.trim()) };
  } catch {
    return { ok: false as const, message: `Invalid ${field}` };
  }
}

export function normalizeCreateTask(
  raw: z.infer<typeof createTaskBody>,
):
  | { ok: true; value: CreateTaskPayload }
  | { ok: false; message: string } {
  const d = normDue(raw.dueDate);
  if (!d.ok) return d;
  return {
    ok: true,
    value: {
      title: raw.title,
      detail: raw.detail,
      classification:
        raw.classification !== undefined
          ? raw.classification.trim()
          : undefined,
      expectedWorkload: raw.expectedWorkload,
      dueDate: d.value,
      status: raw.status,
      source: raw.source,
    },
  };
}

export function normalizePatchTask(
  raw: z.infer<typeof patchTaskBody>,
):
  | { ok: true; value: z.infer<typeof patchTaskBody> & { dueDate?: string | null } }
  | { ok: false; message: string } {
  if (raw.dueDate === undefined) {
    return { ok: true, value: { ...raw } };
  }
  const d = normDue(raw.dueDate);
  if (!d.ok) return d;
  return { ok: true, value: { ...raw, dueDate: d.value } };
}

export function normalizeCreateEvent(
  raw: z.infer<typeof createEventBody>,
):
  | { ok: true; value: CreateEventPayload }
  | { ok: false; message: string } {
  const start = normReq(raw.startDateTime, "startDateTime");
  if (!start.ok) return start;
  let endIso: string | undefined;
  if (raw.endDateTime !== undefined && raw.endDateTime !== "") {
    const end = normReq(raw.endDateTime, "endDateTime");
    if (!end.ok) return end;
    endIso = end.value;
  }
  return {
    ok: true,
    value: {
      title: raw.title,
      detail: raw.detail,
      expectedWorkload: raw.expectedWorkload,
      startDateTime: start.value,
      endDateTime: endIso,
      source: raw.source,
    },
  };
}

export function normalizePatchEvent(
  raw: z.infer<typeof patchEventBody>,
):
  | {
      ok: true;
      value: {
        title?: string;
        detail?: string;
        expectedWorkload?: number;
        startDateTime?: string;
        endDateTime?: string | null;
        source?: CreateEventPayload["source"];
      };
    }
  | { ok: false; message: string } {
  const out: {
    title?: string;
    detail?: string;
    expectedWorkload?: number;
    startDateTime?: string;
    endDateTime?: string | null;
    source?: CreateEventPayload["source"];
  } = {};

  if (raw.title !== undefined) out.title = raw.title;
  if (raw.detail !== undefined) out.detail = raw.detail;
  if (raw.expectedWorkload !== undefined)
    out.expectedWorkload = raw.expectedWorkload;
  if (raw.source !== undefined) out.source = raw.source;

  if (raw.startDateTime !== undefined) {
    const s = normReq(raw.startDateTime, "startDateTime");
    if (!s.ok) return s;
    out.startDateTime = s.value;
  }

  if (raw.endDateTime !== undefined) {
    if (raw.endDateTime === "") {
      out.endDateTime = undefined;
    } else {
      const e = normReq(raw.endDateTime, "endDateTime");
      if (!e.ok) return e;
      out.endDateTime = e.value;
    }
  }

  return { ok: true, value: out };
}
