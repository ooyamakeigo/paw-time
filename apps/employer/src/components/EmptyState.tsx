import type { Messages } from "@/lib/i18n/messages";

type EmptyStateProps = {
  title: string;
  description: string;
  /** An obake illustration from /public/obake. */
  obake?: string;
};

export function EmptyState({ title, description, obake = "nemurin" }: EmptyStateProps) {
  return (
    <div className="emptyState">
      <img alt="" height={120} src={`/obake/${obake}.webp`} width={120} />
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

export function ApiUnavailable({ m }: { m: Messages }) {
  return (
    <EmptyState
      description={m.common.apiUnavailableDescription}
      obake="nemurin"
      title={m.common.apiUnavailableTitle}
    />
  );
}
