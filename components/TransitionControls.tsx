"use client";
import { useActionState, useEffect, useState } from "react";
import { X } from "lucide-react";
import { transitionSubscription } from "@/app/admin/subscriptions/actions";
import type { TransitionAction } from "@/lib/subscriptions/transitions";
import type { SubscriptionStatus } from "@/lib/subscriptions/types";
import { SubmitButton } from "@/components/SubmitButton";
const labels: Record<TransitionAction, string> = {
  sendQuotation: "Send quotation",
  confirm: "Confirm quotation",
  activate: "Activate subscription",
  pause: "Pause",
  resume: "Resume",
  close: "Close subscription",
  cancel: "Cancel subscription",
};
function TransitionButton({
  id,
  action,
}: {
  id: number;
  action: TransitionAction;
}) {
  const [state, formAction] = useActionState(transitionSubscription, {});
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (state.error) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [state]);
  return (
    <>
      <form action={formAction}>
        <input type="hidden" name="subscription_id" value={id} />
        <input type="hidden" name="action" value={action} />
        <SubmitButton
          variant={
            action === "close" || action === "cancel" ? "outline" : "default"
          }
        >
          {labels[action]}
        </SubmitButton>
        {state.error && (
          <p className="mt-2 max-w-sm text-sm text-destructive">
            {state.error}
          </p>
        )}
      </form>
      {visible && state.error && (
        <div
          role="alert"
          className="fixed right-4 bottom-4 z-50 flex max-w-[calc(100vw-2rem)] items-start gap-4 rounded-xl border bg-background p-5 text-sm sm:max-w-md"
        >
          <p>{state.error}</p>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setVisible(false)}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </>
  );
}
export function TransitionControls({
  id,
  status,
  allowPause,
}: {
  id: number;
  status: SubscriptionStatus;
  allowPause: boolean;
}) {
  const actions: TransitionAction[] =
    status === "draft"
      ? ["sendQuotation", "cancel"]
      : status === "quotation"
        ? ["confirm", "cancel"]
        : status === "confirmed"
          ? ["activate"]
          : status === "active"
            ? [...(allowPause ? ["pause" as const] : []), "close"]
            : status === "paused"
              ? [...(allowPause ? ["resume" as const] : []), "close"]
              : [];
  const steps = [
    "draft",
    "quotation",
    "confirmed",
    "active",
    ...(status === "paused" ? ["paused"] : []),
    "closed",
  ];
  return (
    <section className="mb-8 border-y py-5">
      <ol
        aria-label="Subscription status"
        className="mb-5 flex flex-wrap gap-x-6 gap-y-3 text-sm"
      >
        {steps.map((step) => (
          <li
            key={step}
            aria-current={status === step ? "step" : undefined}
            className={
              status === step
                ? "font-semibold text-primary"
                : "text-muted-foreground"
            }
          >
            {step[0].toUpperCase() + step.slice(1)}
            {status === step ? " (current)" : ""}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-start gap-3">
        {actions.map((action) => (
          <TransitionButton key={action} id={id} action={action} />
        ))}
      </div>
    </section>
  );
}
