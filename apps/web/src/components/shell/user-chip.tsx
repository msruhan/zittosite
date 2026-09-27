import { cn } from "@/lib/utils";

function initials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({
  fullName,
  className,
}: {
  fullName: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-full",
        "border border-white/60 bg-action-wash text-label font-bold text-action",
        "shadow-[0_12px_28px_rgba(0,108,255,0.18)]",
        className,
      )}
    >
      {initials(fullName)}
    </span>
  );
}

export function UserChip({
  fullName,
  subtitle,
}: {
  fullName: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="hidden text-right leading-tight sm:block">
        <p className="text-body font-bold text-ink">{fullName}</p>
        <p className="font-data text-body text-ink-soft">{subtitle}</p>
      </div>
      <Avatar fullName={fullName} />
    </div>
  );
}
