import { processDueJobs as processLegacyJobs, enqueueReminderJob, resetJobsForTests, type ReminderJob } from "./reminder-jobs-memory";

export type { ReminderJob };
export { enqueueReminderJob, resetJobsForTests };

export function processDueJobs(nowIso: string): { processed: ReminderJob[]; delivered: number; reason?: string } {
  return processLegacyJobs(nowIso);
}
