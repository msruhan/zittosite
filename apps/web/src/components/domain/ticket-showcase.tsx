import { TicketSpecimen } from "@/components/auth/ticket-specimen";
import { cn } from "@/lib/utils";

/**
 * Dashboard stage that hosts the animated order-ticket specimen.
 */
export function TicketShowcase({
  className,
  headline = "Satu nomor tiket, dari dibuat sampai selesai.",
  body = "Setiap order mendapat Order ID permanen. Pantau di website, kerjakan di Telegram, hasilnya kembali ke tiket yang sama.",
}: {
  className?: string;
  headline?: string;
  body?: string;
}) {
  return (
    <section
      className={cn(
        "auth-stage relative overflow-hidden rounded-[var(--radius-card)]",
        "p-5 text-white sm:p-7",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="auth-orb pointer-events-none absolute -right-12 -top-10 size-56 rounded-full bg-action/40 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="auth-orb-alt pointer-events-none absolute -bottom-16 -left-10 size-48 rounded-full bg-accent-sky/30 blur-3xl"
      />

      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] lg:items-center">
        <div className="max-w-md">
          <p className="text-label uppercase tracking-[0.16em] text-accent-sky">
            Order lifecycle
          </p>
          <h2 className="mt-2 text-headline text-white">{headline}</h2>
          <p className="mt-2.5 text-body leading-relaxed text-white/70">{body}</p>
        </div>

        <div className="relative mx-auto w-full max-w-sm lg:mx-0 lg:justify-self-end">
          <TicketSpecimen />
        </div>
      </div>
    </section>
  );
}
