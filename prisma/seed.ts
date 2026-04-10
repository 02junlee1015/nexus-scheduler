import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { addDays, addHours } from "date-fns";
import * as taskService from "../lib/services/task-service";
import * as eventService from "../lib/services/event-service";

const prisma = new PrismaClient();

async function main() {
  const owner =
    (await prisma.user.findUnique({ where: { email: "legacy@nexus.local" } })) ??
    (await prisma.user.findFirst({ orderBy: { createdAt: "asc" } }));

  if (!owner) {
    console.log("No user row — run app and register first, or rely on migration legacy user.");
    return;
  }

  await prisma.calendarEvent.deleteMany({ where: { userId: owner.id } });
  await prisma.task.deleteMany({ where: { userId: owner.id } });

  const today = new Date();
  const d1 = addDays(today, 1);
  const d3 = addDays(today, 3);

  await taskService.createTask({
    userId: owner.id,
    title: "Investor memo",
    detail: "Narrative + appendix; align with finance.",
    expectedWorkload: 3,
    dueDate: d1.toISOString(),
    status: "in_progress",
    source: "manual",
  });

  await taskService.createTask({
    userId: owner.id,
    title: "Design QA pass",
    detail: "Mobile breakpoints and motion review.",
    expectedWorkload: 2,
    dueDate: d3.toISOString(),
    status: "todo",
    source: "manual",
  });

  await taskService.createTask({
    userId: owner.id,
    title: "Weekly planning",
    detail: "Light sweep of backlog.",
    expectedWorkload: 1,
    dueDate: today.toISOString(),
    status: "todo",
    source: "ai",
  });

  await taskService.createTask({
    userId: owner.id,
    title: "Read one saved essay",
    detail: "Product thinking; short notes only.",
    classification: "독서",
    expectedWorkload: 1,
    dueDate: null,
    status: "todo",
    source: "manual",
  });

  const startMeet = addHours(today, 4);
  const endMeet = addHours(startMeet, 1);
  await eventService.createEvent({
    userId: owner.id,
    title: "Team sync",
    detail: "Roadmap checkpoints.",
    expectedWorkload: 2,
    startDateTime: startMeet.toISOString(),
    endDateTime: endMeet.toISOString(),
    source: "manual",
  });

  console.log("Seed complete for user", owner.email);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
