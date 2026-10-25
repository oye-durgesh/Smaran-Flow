"use client";

import { Modal } from "@/components/smaran/modal";
import { Button } from "@/components/ui/button";

export function ResetDemoDialog({ open, onOpenChange, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; onConfirm: () => void }) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Start with an empty family?"
      description="This removes every person, reminder, appointment, document and measurement stored in this browser. You can add your family again from Settings."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Keep my changes</Button>
          <Button onClick={() => { onOpenChange(false); onConfirm(); }}>Reset sample data</Button>
        </>
      }
    />
  );
}
