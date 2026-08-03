"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/**
 * A modal stays centred — it is not anchored to a trigger, so
 * transform-origin: center is correct here (unlike a popover).
 * Enter runs 200ms ease-out; exit is faster at 150ms.
 */
export function DialogContent({
  className,
  title,
  description,
  children,
  footer,
}: {
  className?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-50 bg-ink/40",
          "data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out",
        )}
      />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg",
          "-translate-x-1/2 -translate-y-1/2",
          "max-h-[calc(100vh-3rem)] overflow-y-auto",
          "rounded-lg border border-hairline bg-surface shadow-overlay",
          "data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
          <div className="space-y-1">
            <DialogPrimitive.Title className="text-headline text-ink">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-body text-ink-soft">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close
            aria-label="Tutup"
            className={cn(
              "-mr-1 -mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md",
              "text-ink-soft transition-[background-color,color,transform] duration-150 ease-out-strong",
              "hover:bg-mist hover:text-ink active:scale-[0.97]",
            )}
          >
            <X className="size-4" aria-hidden="true" />
          </DialogPrimitive.Close>
        </div>

        <div className="px-5 py-5">{children}</div>

        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-hairline px-5 py-4">
            {footer}
          </div>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
