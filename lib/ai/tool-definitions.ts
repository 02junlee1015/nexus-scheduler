/** OpenAI Chat Completions `tools` payload — modular for future expansion */
export const schedulerTools = [
  {
    type: "function",
    function: {
      name: "createTask",
      description:
        "Create a to-do task. Optionally set deadline (ISO 8601) and workload 1–3.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title" },
          detail: { type: "string", description: "Optional notes" },
          classification: {
            type: "string",
            description:
              "Optional bucket for no-deadline / backlog tasks (e.g. reading, chores)",
          },
          expectedWorkload: {
            type: "integer",
            enum: [1, 2, 3],
            description: "1 weakest (green), 2 medium (blue), 3 hardest (red)",
          },
          dueDate: {
            type: "string",
            description: "Deadline as ISO date/datetime or null",
          },
          status: {
            type: "string",
            enum: ["todo", "in_progress", "done"],
          },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "updateTask",
      description:
        "Update an existing task by id. Include only fields to change.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          detail: { type: "string" },
          classification: { type: "string" },
          expectedWorkload: {
            type: "integer",
            enum: [1, 2, 3],
            description: "1 green/weakest, 2 blue/medium, 3 red/hardest",
          },
          dueDate: { type: "string", description: "ISO or null to clear" },
          status: {
            type: "string",
            enum: ["todo", "in_progress", "done"],
          },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deleteTask",
      description: "Delete a task by id. Linked calendar block is removed.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createEvent",
      description:
        "Create a calendar event with start (and optional end) ISO datetimes. Creates a linked to-do for the same day.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          expectedWorkload: {
            type: "integer",
            enum: [1, 2, 3],
            description: "1 green, 2 blue, 3 red",
          },
          startDateTime: { type: "string" },
          endDateTime: { type: "string" },
        },
        required: ["title", "startDateTime"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "updateEvent",
      description: "Update a calendar event by id.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          detail: { type: "string" },
          expectedWorkload: {
            type: "integer",
            enum: [1, 2, 3],
            description: "1 green, 2 blue, 3 red",
          },
          startDateTime: { type: "string" },
          endDateTime: { type: "string" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deleteEvent",
      description:
        "Delete a calendar event. Linked task remains but loses deadline.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "queryTasks",
      description: "Search and list tasks with optional filters.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          titleContains: { type: "string" },
          dueBefore: { type: "string" },
          dueAfter: { type: "string" },
          minWorkload: { type: "integer" },
          limit: { type: "integer" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "queryEvents",
      description: "Search calendar events.",
      parameters: {
        type: "object",
        properties: {
          startAfter: { type: "string" },
          startBefore: { type: "string" },
          titleContains: { type: "string" },
          limit: { type: "integer" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "syncTaskAndCalendar",
      description:
        "Re-run sync for a task id (usually unnecessary; use after manual DB fixes).",
      parameters: {
        type: "object",
        properties: { taskId: { type: "string" } },
        required: ["taskId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sendFriendRequest",
      description:
        "Send a friend request using the other person's Nexus sign-up email. They must already have an account.",
      parameters: {
        type: "object",
        properties: { email: { type: "string" } },
        required: ["email"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "acceptFriendRequest",
      description: "Accept an incoming friend request by friendship id.",
      parameters: {
        type: "object",
        properties: { friendshipId: { type: "string" } },
        required: ["friendshipId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listFriends",
      description:
        "List incoming/outgoing pending requests and accepted friends for the current user.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "assignTaskToFriend",
      description:
        "Assign a task proposal to an accepted friend by their email. They choose workload when accepting; they must accept before it becomes a real task.",
      parameters: {
        type: "object",
        properties: {
          recipientEmail: { type: "string" },
          title: { type: "string" },
          detail: { type: "string" },
          deadline: { type: "string", description: "ISO datetime or null" },
        },
        required: ["recipientEmail", "title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listAssignedTasks",
      description:
        "List collaborative assignment requests. role: sent | received | inbox (pending for me) | all",
      parameters: {
        type: "object",
        properties: {
          role: {
            type: "string",
            enum: ["sent", "received", "inbox", "all"],
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "acceptAssignedTask",
      description:
        "Accept an assignment so it becomes your task with calendar sync. You must set expectedWorkload 1–3 for how heavy it feels on your calendar (only the recipient chooses this).",
      parameters: {
        type: "object",
        properties: {
          assignmentId: { type: "string" },
          expectedWorkload: { type: "number", description: "1–3, required" },
        },
        required: ["assignmentId", "expectedWorkload"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "requestAssignmentAdjustment",
      description: "Ask the sender to change the assignment; optional proposed deadline ISO.",
      parameters: {
        type: "object",
        properties: {
          assignmentId: { type: "string" },
          message: { type: "string" },
          proposedDeadline: { type: "string" },
        },
        required: ["assignmentId", "message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reviseAssignedTask",
      description:
        "Sender updates an assignment after recipient requested adjustment. Do not set workload — the recipient still chooses that when they accept.",
      parameters: {
        type: "object",
        properties: {
          assignmentId: { type: "string" },
          title: { type: "string" },
          detail: { type: "string" },
          deadline: { type: "string" },
        },
        required: ["assignmentId", "title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancelAssignedTask",
      description: "Sender cancels a pending or resubmitted assignment.",
      parameters: {
        type: "object",
        properties: { assignmentId: { type: "string" } },
        required: ["assignmentId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "declineAssignedTask",
      description: "Recipient declines a pending assignment.",
      parameters: {
        type: "object",
        properties: { assignmentId: { type: "string" } },
        required: ["assignmentId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listNotifications",
      description: "Recent in-app notifications for the user.",
      parameters: {
        type: "object",
        properties: { limit: { type: "integer" } },
      },
    },
  },
];
