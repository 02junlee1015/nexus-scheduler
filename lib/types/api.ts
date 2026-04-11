import type { WorkloadLevel } from "@/lib/constants/workload";

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskSource = "manual" | "calendar" | "ai" | "assigned";
export type EventSource = "manual" | "todo" | "ai";

export type TaskDTO = {
  id: string;
  title: string;
  detail: string;
  classification: string;
  expectedWorkload: WorkloadLevel;
  dueDate: string | null;
  status: TaskStatus;
  source: TaskSource;
  linkedEventId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CalendarEventDTO = {
  id: string;
  title: string;
  detail: string;
  expectedWorkload: WorkloadLevel;
  startDateTime: string;
  endDateTime: string;
  linkedTaskId: string | null;
  /** When linked to a to-do, reflects task status (e.g. done → muted calendar block). */
  linkedTaskStatus: TaskStatus | null;
  source: EventSource;
  createdAt: string;
  updatedAt: string;
};

export type CreateTaskInput = {
  userId: string;
  title: string;
  detail?: string;
  classification?: string;
  expectedWorkload?: number;
  dueDate?: string | null;
  status?: TaskStatus;
  source?: TaskSource;
};

/** API body normalized; `userId` is added from the session when persisting. */
export type CreateTaskPayload = Omit<CreateTaskInput, "userId">;

export type UpdateTaskInput = Partial<CreateTaskInput> & { id: string };

export type CreateEventInput = {
  userId: string;
  title: string;
  detail?: string;
  expectedWorkload?: number;
  startDateTime: string;
  endDateTime?: string;
  source?: EventSource;
  /** If true, do not auto-create a mirror task (internal) */
  skipMirrorTask?: boolean;
};

export type CreateEventPayload = Omit<CreateEventInput, "userId">;

export type UpdateEventInput = Partial<
  Omit<CreateEventInput, "startDateTime" | "endDateTime">
> & {
  id: string;
  startDateTime?: string;
  /** Omit or set ISO string; null clears to default duration from start */
  endDateTime?: string | null;
};
