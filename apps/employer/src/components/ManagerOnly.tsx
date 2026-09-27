import type { Messages } from "@/lib/i18n/messages";
import { EmptyState } from "./EmptyState";

/** Shown in place of a manager-only page when staff open it. */
export function ManagerOnly({ m }: { m: Messages }) {
  return <EmptyState description={m.app.managerOnly} obake="senpai" title={m.app.managerOnlyShort} />;
}
