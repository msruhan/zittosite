import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * An empty screen names what is missing and offers the action that would
 * fill it. It is never a shrug.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-full border border-hairline bg-action-wash text-action [&_svg]:size-5"
        >
          {icon}
        </span>
      ) : null}
      <div className="space-y-1">
        <p className="text-title text-ink">{title}</p>
        {description ? (
          <p className="mx-auto max-w-[46ch] text-body text-ink-soft">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
