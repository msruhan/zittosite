import { cn } from "@/lib/utils";

/**
 * A faster spinner makes the same wait feel shorter, so this runs at 600ms
 * rather than the conventional 1s.
 */
export function Spinner({
  className,
  label = "Memuat",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "inline-block size-4 shrink-0 animate-spinner rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}
