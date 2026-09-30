"use client";

import * as React from "react";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { IMEI_LENGTH, MAX_BULK_IMEIS, parseImeiList } from "@/lib/imei-list";

/**
 * IMEI entry as chips: type 15 digits and press Enter (or leave the field) to
 * wrap it. Pasting several IMEIs splits them into chips at once.
 */
export function ImeiChipInput({
  id,
  imeis,
  onImeisChange,
  draft,
  onDraftChange,
  onError,
  invalid,
}: {
  id: string;
  imeis: string[];
  onImeisChange: (next: string[]) => void;
  draft: string;
  onDraftChange: (next: string) => void;
  onError: (message: string | undefined) => void;
  invalid?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const full = imeis.length >= MAX_BULK_IMEIS;

  function commit(value: string, { quiet = false } = {}): boolean {
    if (!value) return false;
    let problem: string | undefined;
    if (value.length !== IMEI_LENGTH) {
      problem = `IMEI harus ${IMEI_LENGTH} digit (saat ini ${value.length}).`;
    } else if (imeis.includes(value)) {
      problem = "IMEI ini sudah ditambahkan.";
    } else if (full) {
      problem = `Maksimal ${MAX_BULK_IMEIS} IMEI per order.`;
    }
    if (problem) {
      if (!quiet) onError(problem);
      return false;
    }
    onImeisChange([...imeis, value]);
    onDraftChange("");
    onError(undefined);
    return true;
  }

  function remove(index: number) {
    onImeisChange(imeis.filter((_, i) => i !== index));
    onError(undefined);
    inputRef.current?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit(draft);
    } else if (event.key === "Backspace" && !draft && imeis.length) {
      event.preventDefault();
      remove(imeis.length - 1);
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text");
    if (!/[\r\n,;\s]/.test(text.trim()) && text.replace(/\D/g, "").length <= IMEI_LENGTH) {
      return;
    }
    event.preventDefault();
    const parsed = parseImeiList(text.replace(/[,;]/g, "\n"));
    const fresh = [...new Set(parsed.imeis)].filter((imei) => !imeis.includes(imei));
    const room = MAX_BULK_IMEIS - imeis.length;
    onImeisChange([...imeis, ...fresh.slice(0, room)]);
    const problems = [...parsed.errors];
    if (fresh.length > room) {
      problems.push(`Maksimal ${MAX_BULK_IMEIS} IMEI per order; ${fresh.length - room} tidak ditambahkan.`);
    }
    onError(problems.length ? problems.join(" ") : undefined);
  }

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className={cn(
        "flex min-h-11 w-full cursor-text flex-wrap items-center gap-1.5 rounded-md border bg-surface px-2 py-1.5",
        "transition-[border-color,box-shadow] duration-150 ease-out-strong",
        "focus-within:border-action focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-action)_18%,transparent)]",
        invalid ? "border-refused-edge" : "border-hairline",
      )}
    >
      {imeis.map((imei, index) => (
        <span
          key={imei}
          className="inline-flex animate-pop-in items-center gap-1.5 rounded-md border border-action/25 bg-action-wash py-1 pl-2 pr-1 font-data tabular text-body text-ink"
        >
          <span className="text-ink-faint">{index + 1}</span>
          {imei}
          <button
            type="button"
            aria-label={`Hapus IMEI ${imei}`}
            onClick={(event) => {
              event.stopPropagation();
              remove(index);
            }}
            className="flex size-5 items-center justify-center rounded text-ink-soft transition-colors duration-150 hover:bg-action/10 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
          >
            <X className="size-3.5" weight="bold" aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={id}
        name="imei"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        disabled={full}
        aria-invalid={invalid || undefined}
        value={draft}
        placeholder={
          full
            ? `Maksimal ${MAX_BULK_IMEIS} IMEI`
            : imeis.length
              ? "IMEI berikutnya…"
              : "Contoh 356938035643809"
        }
        onChange={(event) => {
          onDraftChange(event.target.value.replace(/\D/g, "").slice(0, IMEI_LENGTH));
          onError(undefined);
        }}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={() => {
          if (draft.length === IMEI_LENGTH) commit(draft, { quiet: true });
        }}
        className="h-8 min-w-[12ch] flex-1 bg-transparent px-1.5 font-data tabular tracking-[0.02em] text-body text-ink placeholder:text-ink-faint focus:outline-none disabled:cursor-not-allowed"
      />
    </div>
  );
}
