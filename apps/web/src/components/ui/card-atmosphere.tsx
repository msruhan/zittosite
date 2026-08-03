import { cn } from "@/lib/utils";

export type CardAtmosphereTone = "action" | "cleared" | "working" | "sky";

const TONE_BLOBS: Record<CardAtmosphereTone, string> = {
  action: "card-mesh-action",
  cleared: "card-mesh-cleared",
  working: "card-mesh-working",
  sky: "card-mesh-sky",
};

/**
 * Soft mesh glow + diagonal hatch behind card content.
 * Absolute, non-interactive; parent must be `relative overflow-hidden`.
 */
export function CardAtmosphere({
  tone = "action",
  className,
}: {
  tone?: CardAtmosphereTone;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 z-0 overflow-hidden", className)}
    >
      <span className={cn("card-mesh-blob", TONE_BLOBS[tone])} />
      <span className="card-mesh-blob card-mesh-blob-secondary" />
      <span className="card-hatch" />
    </div>
  );
}
