"use client";

import { EXTRA_FIELD_OPTIONS, type ExtraFieldKey } from "@/lib/order-fields";
import { cn } from "@/lib/utils";

/** "Field tambahan" checkboxes for Layanan Spesial services. */
export function ExtraFieldPicker({
  value,
  onToggle,
  error,
  hint = "Yang dicentang wajib diisi user saat order dan ikut dikirim ke supplier (QNT, EMAIL, USERNAME, PASSWORD, NOTES). Qnt tidak mengubah harga.",
}: {
  value: Partial<Record<ExtraFieldKey, boolean>>;
  onToggle: (key: ExtraFieldKey, checked: boolean) => void;
  error?: string;
  hint?: string;
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-body font-medium text-ink">Field tambahan</legend>
      <p className="mb-2 text-body text-ink-soft">{hint}</p>
      <div className="flex flex-wrap gap-2">
        {EXTRA_FIELD_OPTIONS.map((option) => (
          <label
            key={option.key}
            className={cn(
              "inline-flex h-10 cursor-pointer items-center gap-2.5 rounded-md border px-3.5 text-body",
              "transition-colors duration-150 ease-out-strong",
              value[option.key]
                ? "border-action bg-action-wash font-medium text-action"
                : "border-hairline bg-surface text-ink hover:bg-mist",
            )}
          >
            <input
              type="checkbox"
              checked={Boolean(value[option.key])}
              onChange={(event) => onToggle(option.key, event.target.checked)}
              className="size-4 rounded-sm border-hairline accent-action"
            />
            {option.label}
          </label>
        ))}
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 text-body text-refused-ink">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
