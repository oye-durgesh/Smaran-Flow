"use client";

import type { ReactNode } from "react";
import { StoreProvider } from "@/lib/store/store";
import { ViewProvider } from "@/lib/store/view";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <StoreProvider>
      <ViewProvider>{children}</ViewProvider>
    </StoreProvider>
  );
}
