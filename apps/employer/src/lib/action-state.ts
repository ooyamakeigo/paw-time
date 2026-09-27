export type ActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
  /** Submitted values, returned on errors so the form keeps what was typed. */
  fields?: Record<string, string>;
};

export const idleActionState: ActionState = { status: "idle", message: null };
