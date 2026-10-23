"use client";

import type { ReactNode } from "react";
import { StoreProvider } from "@/lib/store/store";
import { ViewProvider } from "@/lib/store/view";
import { BootScreen } from "./boot";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <StoreProvider fallback={<BootScreen />}>
      <ViewProvider>{children}</ViewProvider>
    </StoreProvider>
  );
}
