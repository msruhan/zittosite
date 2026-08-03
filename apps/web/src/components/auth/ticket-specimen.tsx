import { Check } from "lucide-react";
import { DataValue, TicketId } from "@/components/ui/data-value";
import { StatusBadge } from "@/components/ui/status-badge";
import { TicketStub } from "@/components/ui/ticket-stub";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Animated order-ticket specimen for dashboard stages.
 * Motion is CSS-only so this stays a server component.
 */
export function TicketSpecimen() {
  const steps = [
    "Order dibuat",
    "Pembayaran diterima",
    "Diproses admin",
    "Selesai",
  ];

  return (
    <figure className="relative w-full max-w-sm">
      <figcaption className="mb-4 text-label uppercase tracking-[0.16em] text-accent-sky/90">
        Tiket order
      </figcaption>

      {/* Soft pedestal glow */}
      <div
        aria-hidden="true"
        className="auth-glow pointer-events-none absolute -bottom-6 left-1/2 h-16 w-[78%] -translate-x-1/2 rounded-full bg-action/50 blur-2xl"
      />

      {/* Ghost ticket — depth layer */}
      <div
        aria-hidden="true"
        className={cn(
          "auth-float-ghost absolute inset-x-3 top-10 -z-10",
          "overflow-hidden rounded-xl border border-white/10",
          "bg-white/10 shadow-overlay backdrop-blur-sm",
        )}
      >
        <div className="h-44 opacity-40" />
      </div>

      {/* Primary ticket */}
      <div className="auth-float relative">
        <div
          className={cn(
            "relative overflow-hidden rounded-xl border border-white/20",
            "bg-surface shadow-overlay",
          )}
        >
          {/* Shine sweep */}
          <div
            aria-hidden="true"
            className="auth-shine pointer-events-none absolute inset-y-0 left-0 z-10 w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent"
          />

          <div className="relative p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-label uppercase tracking-[0.12em] text-ink-soft">
                  Order ID
                </p>
                <TicketId className="mt-1.5 block">ZT2607290009</TicketId>
              </div>
              <StatusBadge status="done" stampIn />
            </div>

            <dl className="mt-5 divide-y divide-hairline border-t border-hairline">
              <div className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="text-body text-ink-soft">Layanan</dt>
                <dd className="text-body font-medium text-ink">Aktivasi IMEI</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="text-body text-ink-soft">IMEI</dt>
                <dd>
                  <DataValue>352XXXXXXXXXXXX</DataValue>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="text-body text-ink-soft">Harga</dt>
                <dd>
                  <DataValue emphasis>{formatRupiah(140_000)}</DataValue>
                </dd>
              </div>
            </dl>

            <ol className="mt-5 space-y-2.5 border-t border-hairline pt-4">
              {steps.map((step, index) => (
                <li
                  key={step}
                  className="auth-step flex items-center gap-2.5 text-body text-ink"
                  style={{ animationDelay: `${700 + index * 220}ms` }}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full",
                      "bg-cleared-ink text-white",
                      "shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-cleared-ink)_18%,transparent)]",
                    )}
                  >
                    <Check className="size-2.5" strokeWidth={3} />
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <TicketStub className="bg-surface [&_span]:bg-action-deep/40" />
        </div>
      </div>
    </figure>
  );
}
