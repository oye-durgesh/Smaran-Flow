"use client";

import { Modal } from "@/components/smaran/modal";
import { Button } from "@/components/ui/button";

export function ResetDemoDialog({ open, onOpenChange, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; onConfirm: () => void }) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Reset sample family?"
      description="This restores Mummy and Papa, their reminders, appointments, documents and memory. Anything you added will be cleared."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Keep my changes</Button>
          <Button onClick={() => { onOpenChange(false); onConfirm(); }}>Reset sample data</Button>
        </>
      }
    />
  );
}
