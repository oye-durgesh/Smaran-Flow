import { NextResponse } from "next/server";
import { backendConfigured, cronSecretConfigured, serviceRoleConfigured } from "@/lib/server/env";
import { processDueJobs } from "@/lib/server/reminder-jobs";
import { processPersistedDueReminders } from "@/lib/server/in-app-processor";
import { schedulerStatus } from "@/lib/in-app-reminders";
import { zonedNow } from "@/lib/timezone";

/** Minute worker. In-app notifications persist only when the service role can write. Host cron is not assumed to be running. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const memory = processDueJobs(zonedNow(undefined, now).timestamp);
  const persisted = await processPersistedDueReminders(now);
  const honesty = schedulerStatus({
    cronSecretConfigured: cronSecretConfigured(),
    serviceRoleConfigured: serviceRoleConfigured(),
    hostingCronVerified: false,
  });

  if (!backendConfigured() && !serviceRoleConfigured()) {
    return NextResponse.json({
      status: "device_local",
      channel: "in_app",
      delivered: persisted.created,
      processed: memory.processed.length,
      reason: honesty.honest,
      schedulerConfigured: honesty.configured,
      resolution: "minute",
    });
  }

  if (persisted.error) {
    return NextResponse.json({
      status: "blocked",
      channel: "in_app",
      delivered: 0,
      processed: memory.processed.length,
      reason: persisted.error,
      schedulerConfigured: honesty.configured,
      resolution: "minute",
    });
  }

  return NextResponse.json({
    status: persisted.created > 0 ? "delivered_in_app" : "idle",
    channel: "in_app",
    delivered: persisted.created,
    duplicates: persisted.duplicates,
    processed: memory.processed.length + persisted.created + persisted.duplicates,
    webPush: memory.reason,
    reason: honesty.configured ? undefined : honesty.honest,
    schedulerConfigured: honesty.configured,
    resolution: "minute",
  });
}
