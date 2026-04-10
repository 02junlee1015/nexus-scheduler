import { z } from "zod";
import {
  MAX_BULK_EVENTS,
  MAX_BULK_TASKS,
} from "@/lib/constants/api-limits";

/** Structural validation; dates normalized in routes via `normalizeTaskInput` / `normalizeEventInput`. */
export const createTaskBody = z.object({
  title: z.string().min(1),
  detail: z.string().optional(),
  classification: z.string().max(120).optional(),
  expectedWorkload: z.coerce.number().int().min(1).max(3).optional(),
  dueDate: z.union([z.string(), z.null()]).optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  source: z.enum(["manual", "calendar", "ai"]).optional(),
});

export const patchTaskBody = createTaskBody.partial();

export const createEventBody = z.object({
  title: z.string().min(1),
  detail: z.string().optional(),
  expectedWorkload: z.coerce.number().int().min(1).max(3).optional(),
  startDateTime: z.string().min(1),
  endDateTime: z.union([z.string().min(1), z.literal("")]).optional(),
  source: z.enum(["manual", "todo", "ai"]).optional(),
});

export const patchEventBody = z.object({
  title: z.string().min(1).optional(),
  detail: z.string().optional(),
  expectedWorkload: z.coerce.number().int().min(1).max(3).optional(),
  startDateTime: z.string().min(1).optional(),
  endDateTime: z.union([z.string().min(1), z.literal("")]).optional(),
  source: z.enum(["manual", "todo", "ai"]).optional(),
});

export const bulkTasksBody = z.object({
  tasks: z.array(createTaskBody).min(1).max(MAX_BULK_TASKS),
});

export const bulkEventsBody = z.object({
  events: z.array(createEventBody).min(1).max(MAX_BULK_EVENTS),
});
