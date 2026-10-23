"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-confirmed" />,
        info: <InfoIcon className="size-4 text-brown" />,
        warning: <TriangleAlertIcon className="size-4 text-waiting" />,
        error: <OctagonXIcon className="size-4 text-missed" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--smaran-surface-raised)",
          "--normal-text": "var(--smaran-text)",
          "--normal-border": "var(--smaran-border)",
          "--border-radius": "16px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast !shadow-[var(--shadow-raised)] !font-sans",
          description: "!text-ink-muted",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
