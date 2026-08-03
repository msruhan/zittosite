import { Check, Slash, X } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { ORDER_STATUS, ORDER_STATUS_FLOW, type FlowStatus } from "@/lib/status";
import type { OrderDetail, OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEP_COPY: Record<FlowStatus, { title: string; pending: string }> = {
  waiting_payment: {
    title: "Order dibuat",
    pending: "Order belum dibuat",
  },
  paid: {
    title: "Pembayaran diterima",
    pending: "Menunggu pembayaran diselesaikan",
  },
  waiting_action: {
    title: "Masuk antrean admin",
    pending: "Menunggu pembayaran terverifikasi",
  },
  in_process: {
    title: "Sedang diproses admin",
    pending: "Menunggu admin mengambil order",
  },
  done: {
    title: "Selesai",
    pending: "Menunggu pengerjaan selesai",
  },
};

type StepState = "complete" | "current" | "pending";

function Disc({ state, failure }: { state: StepState; failure?: "rejected" | "cancel" }) {
  if (failure) {
    const Icon = failure === "rejected" ? X : Slash;
    return (
      <span
        aria-hidden="true"
        className={cn(
          "relative z-10 flex size-6 items-center justify-center rounded-full border text-white",
          failure === "rejected"
            ? "border-refused-ink bg-refused-ink"
            : "border-void-edge bg-void-ink",
        )}
      >
        <Icon className="size-3.5" strokeWidth={2.5} />
      </span>
    );
  }

  if (state === "complete") {
    return (
      <span
        aria-hidden="true"
        className="relative z-10 flex size-6 items-center justify-center rounded-full border border-cleared-ink bg-cleared-ink text-white"
      >
        <Check className="size-3.5" strokeWidth={2.5} />
      </span>
    );
  }

  if (state === "current") {
    return (
      <span
        aria-hidden="true"
        className="relative z-10 flex size-6 items-center justify-center rounded-full border border-action bg-action"
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-action/35 opacity-60 [animation-duration:1.8s]" />
        <span className="relative size-2 rounded-full bg-white" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="relative z-10 flex size-6 items-center justify-center rounded-full border border-hairline bg-surface"
    >
      <span className="size-2 rounded-full bg-hairline" />
    </span>
  );
}

/**
 * The order's status board. Vertical so every step can carry its own
 * timestamp, and the connector is green behind what is done, so the eye finds
 * "where am I" before reading a word.
 */
export function OrderStepper({ order }: { order: OrderDetail }) {
  const failure: "rejected" | "cancel" | null =
    order.status === "rejected" || order.status === "cancel"
      ? order.status
      : null;

  const reachedIndex = failure
    ? // A failed order still shows how far it actually got.
      Math.max(
        0,
        ORDER_STATUS_FLOW.findIndex(
          (s) => s === (order.startedAt ? "in_process" : "waiting_action"),
        ),
      )
    : ORDER_STATUS_FLOW.indexOf(order.status as FlowStatus);

  const timestampFor = (status: OrderStatus): string | null =>
    order.activity.find((log) => log.status === status)?.createdAt ?? null;

  const steps = ORDER_STATUS_FLOW.map((status, index) => {
    const state: StepState =
      index < reachedIndex
        ? "complete"
        : index === reachedIndex
          ? failure
            ? "complete"
            : order.status === "done"
              ? "complete"
              : "current"
          : "pending";

    return { status, state, index };
  });

  const failureLog = failure
    ? order.activity.find((log) => log.status === failure)
    : null;

  return (
    <ol className="relative">
      {steps.map((step, index) => {
        const copy = STEP_COPY[step.status];
        const timestamp = timestampFor(step.status);
        const isLast = index === steps.length - 1 && !failure;
        const nextComplete = steps[index + 1]?.state === "complete";

        return (
          <li
            key={step.status}
            className="relative flex gap-3 pb-5 last:pb-0"
          >
            {!isLast ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-[11px] top-6 h-[calc(100%-1.5rem)] w-0.5 rounded-full",
                  nextComplete || (failure && step.state === "complete")
                    ? "bg-cleared-edge"
                    : "bg-hairline",
                )}
              />
            ) : null}

            <Disc state={step.state} />

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p
                  className={cn(
                    "text-body",
                    step.state === "current"
                      ? "font-semibold text-action"
                      : step.state === "complete"
                        ? "font-medium text-ink"
                        : "text-ink-soft",
                  )}
                >
                  {step.state === "pending" ? copy.pending : copy.title}
                </p>
                {timestamp ? (
                  <time
                    dateTime={timestamp}
                    className="font-data tabular text-body text-ink-soft"
                  >
                    {formatDateTime(timestamp)}
                  </time>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}

      {failure && failureLog ? (
        <li className="relative flex gap-3">
          <Disc state="complete" failure={failure} />
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <p
                className={cn(
                  "text-body font-semibold",
                  failure === "rejected" ? "text-refused-ink" : "text-void-ink",
                )}
              >
                {ORDER_STATUS[failure].label}
              </p>
              <time
                dateTime={failureLog.createdAt}
                className="font-data tabular text-body text-ink-soft"
              >
                {formatDateTime(failureLog.createdAt)}
              </time>
            </div>
            <p className="mt-0.5 text-body text-ink-soft">{failureLog.note}</p>
          </div>
        </li>
      ) : null}
    </ol>
  );
}
