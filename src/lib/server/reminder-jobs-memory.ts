function vapidConfigured(): boolean {
  return Boolean(process.env.VAPID_PRIVATE_KEY?.trim());
}

export interface ReminderJob {
  id: string;
  idempotencyKey: string;
  reminderId: string;
  dueAt: string;
  status: "scheduled" | "attempted" | "blocked" | "failed";
  attempts: number;
}

const jobs = new Map<string, ReminderJob>();

export function enqueueReminderJob(input: { idempotencyKey: string; reminderId: string; dueAt: string }): ReminderJob {
  const existing = jobs.get(input.idempotencyKey);
  if (existing) return existing;
  const job: ReminderJob = {
    id: `job-${input.idempotencyKey}`,
    idempotencyKey: input.idempotencyKey,
    reminderId: input.reminderId,
    dueAt: input.dueAt,
    status: "scheduled",
    attempts: 0,
  };
  jobs.set(input.idempotencyKey, job);
  return job;
}

/** Legacy in-memory queue. Does not send web-push without VAPID. In-app delivery is processPersistedDueReminders. */
export function processDueJobs(nowIso: string): { processed: ReminderJob[]; delivered: number; reason?: string } {
  const due = [...jobs.values()].filter((j) => j.status === "scheduled" && j.dueAt <= nowIso);
  if (!vapidConfigured()) {
    for (const job of due) {
      job.status = "blocked";
      job.attempts += 1;
    }
    return { processed: due, delivered: 0, reason: "VAPID_PRIVATE_KEY is not configured. No web-push was sent. In-app rows use the persisted processor." };
  }
  for (const job of due) {
    job.status = "attempted";
    job.attempts += 1;
  }
  return { processed: due, delivered: 0, reason: "Provider send is not wired; web-push attempts were recorded without claiming delivery." };
}

export function resetJobsForTests() {
  jobs.clear();
}
