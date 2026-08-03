import { cn } from "@/lib/utils";

/**
 * Perforated ticket edge — physical stub bites, not a tiled background.
 * Sit this as the last child of a white card on mist ground.
 */
export function TicketStub({
  className,
  teeth = 18,
}: {
  className?: string;
  teeth?: number;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex h-3 w-full items-end justify-between gap-1 overflow-hidden px-2",
        className,
      )}
    >
      {Array.from({ length: teeth }, (_, i) => (
        <span
          key={i}
          className="mb-[-5px] size-2.5 shrink-0 rounded-full bg-mist"
        />
      ))}
    </div>
  );
}
