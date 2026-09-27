"use client";

import { useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { idleActionState, type ActionState } from "@/lib/action-state";
import { useToast } from "./Toaster";

type ServerAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Runs a server action from a form. Errors stay next to the form; successes
 * become a toast, because a successful action usually re-renders the page and
 * removes the form that was submitted.
 */
export function useFormAction(action: ServerAction) {
  const toast = useToast();
  const [state, setState] = useState<ActionState>(idleActionState);
  const [pending, setPending] = useState(false);
  const latest = useRef(state);
  async function formAction(formData: FormData) {
    setPending(true);
    try {
      const next = await action(latest.current, formData);
      latest.current = next;
      setState(next);
      if (next.status === "success" && next.message) toast(next.message);
    } finally {
      setPending(false);
    }
  }
  return [state, formAction, pending] as const;
}

type ActionFormProps = {
  action: ServerAction;
  children: ReactNode;
  className?: string;
};

/** A form bound to a server action for single-button operations. */
export function ActionForm({ action, children, className }: ActionFormProps) {
  const [state, formAction, pending] = useFormAction(action);
  return (
    <form action={formAction} className={className} data-pending={pending || undefined}>
      {children}
      <ActionMessage state={state} />
    </form>
  );
}

export function ActionMessage({ state }: { state: ActionState }) {
  if (state.status !== "error" || !state.message) return null;
  return (
    <p className="actionMessage actionMessage-error" role="alert">
      {state.message}
    </p>
  );
}

type SubmitButtonProps = {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  name?: string;
  value?: string;
};

export function SubmitButton({ children, pendingLabel = "送信中…", variant = "primary", name, value }: SubmitButtonProps) {
  const { pending, data } = useFormStatus();
  const isThisButton = !name || data?.get(name) === value;
  return (
    <button
      className={`button button-${variant}`}
      disabled={pending}
      name={name}
      type="submit"
      value={value}
    >
      {pending && isThisButton ? pendingLabel : children}
    </button>
  );
}
