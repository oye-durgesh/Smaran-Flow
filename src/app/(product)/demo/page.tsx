import { Suspense } from "react";
import { DemoStudioScreen } from "@/components/screens/demo";

export default function Page() {
  return (
    <Suspense>
      <DemoStudioScreen />
    </Suspense>
  );
}
