import { cn } from "@/lib/utils";

/**
 * The mark is a shield holding a verified device: an IMEI that has been
 * checked and admitted onto the network. Drawn at the same 1.5px stroke
 * weight as the interface hairlines so it sits in the system, not on it.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("size-6 shrink-0", className)}
    >
      <path
        d="M12 2.75 4.75 5.5v6.1c0 4.36 2.9 8.2 7.25 9.65 4.35-1.45 7.25-5.29 7.25-9.65V5.5L12 2.75Z"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <path
        d="M12 2.75 4.75 5.5v6.1c0 4.36 2.9 8.2 7.25 9.65 4.35-1.45 7.25-5.29 7.25-9.65V5.5L12 2.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="m8.75 11.85 2.2 2.2 4.3-4.3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BrandLockup({
  className,
  showTagline = false,
}: {
  className?: string;
  showTagline?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <BrandMark className="size-8 text-action" />
      <span className="flex flex-col leading-none">
        <span className="text-headline font-bold tracking-[-0.02em] text-ink">
          ZITTOSITE
        </span>
        {showTagline ? (
          <span className="mt-1.5 text-label uppercase text-ink-soft">
            Digital IMEI Activation Platform
          </span>
        ) : null}
      </span>
    </span>
  );
}
