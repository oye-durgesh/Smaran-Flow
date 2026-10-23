"use client";

import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store/store";
import { useView } from "@/lib/store/view";
import { startConversation } from "@/lib/store/actions";

/** Open today's reminder conversation, as the parent would from the notification. */
export function useOpenReminderChat() {
  const { commit } = useStore();
  const router = useRouter();
  const { setIncomingReminderId } = useView();
  return (reminderId: string) => {
    commit((s) => startConversation(s, reminderId));
    setIncomingReminderId(null);
    router.push(`/reminders/${reminderId}/chat`);
  };
}

/** Deliver a reminder now: shows the arriving notification instead of waiting for the clock. */
export function useSendReminderNow() {
  const { setIncomingReminderId } = useView();
  return (reminderId: string) => setIncomingReminderId(reminderId);
}
