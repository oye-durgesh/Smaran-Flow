import { AppFrame } from "@/components/shell/app-frame";

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return <AppFrame>{children}</AppFrame>;
}
