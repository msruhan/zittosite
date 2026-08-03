"use client";

import { Toaster as Sonner } from "sonner";

/**
 * Toasts enter and exit from the same edge, which is what makes
 * swipe-to-dismiss feel intuitive. Sonner's own timing is slightly slower
 * than the rest of the UI on purpose — it reads as elegant rather than
 * urgent, and it is not a control the visitor is waiting on.
 */
export function Toaster() {
  return (
    <Sonner
      position="top-right"
      duration={4000}
      gap={10}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-lg !border !border-hairline !bg-surface !shadow-lifted !font-sans !text-body !text-ink",
          title: "!text-title !text-ink",
          description: "!text-body !text-ink-soft",
          actionButton:
            "!rounded-md !bg-action !text-white !font-semibold !text-body",
          cancelButton:
            "!rounded-md !bg-mist !text-ink-soft !font-semibold !text-body",
          success: "!border-cleared-edge",
          error: "!border-refused-edge",
          warning: "!border-working-edge",
          info: "!border-action-wash",
        },
      }}
    />
  );
}
