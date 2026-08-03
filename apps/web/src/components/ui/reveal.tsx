import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Capped entrance stagger for Operate surfaces.
 * Total delay stays under ~200ms so the page never feels choreographed.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  /** Milliseconds. Prefer 0, 40, 80, 120, 160. */
  delay?: number;
  as?: "div" | "section" | "li" | "article";
}) {
  return (
    <Tag
      className={cn("reveal", className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
