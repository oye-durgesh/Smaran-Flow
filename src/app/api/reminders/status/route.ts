import { NextResponse } from "next/server";
import { cronSecretConfigured, serviceRoleConfigured } from "@/lib/server/env";
import { schedulerStatus } from "@/lib/in-app-reminders";

export async function GET() {
  const report = schedulerStatus({
    cronSecretConfigured: cronSecretConfigured(),
    serviceRoleConfigured: serviceRoleConfigured(),
    hostingCronVerified: false,
  });
  return NextResponse.json({
    channel: "in_app",
    resolution: "minute",
    cronSecretConfigured: cronSecretConfigured(),
    serviceRoleConfigured: serviceRoleConfigured(),
    hostingCronVerified: false,
    configured: report.configured,
    message: report.honest,
  });
}
