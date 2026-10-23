"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/lib/store/store";
import { BootScreen } from "@/components/shell/boot";

export default function Page() {
  const { onboarded } = useAppState();
  const router = useRouter();
  useEffect(() => {
    router.replace(onboarded ? "/today" : "/welcome");
  }, [onboarded, router]);
  return <BootScreen />;
}
