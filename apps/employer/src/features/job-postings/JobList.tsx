import type { Application, JobPosting, Store } from "@paw-time/api-contracts";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { EmptyState } from "@/components/EmptyState";
import { createFormatters } from "@/lib/format";
import { fill, type Locale, type Messages } from "@/lib/i18n/messages";
import { closeJobAction, publishJobAction } from "./actions";

const statusOrder: Record<JobPosting["status"], number> = { published: 0, draft: 1, closed: 2 };

type JobListProps = {
  jobs: JobPosting[];
  applications: Application[];
  stores: Store[];
  highlightId?: string | undefined;
  publishExperience: number;
  canManage: boolean;
  m: Messages;
  locale: Locale;
};

export function JobList({ jobs, applications, stores, highlightId, publishExperience, canManage, m, locale }: JobListProps) {
  if (jobs.length === 0) {
    return <EmptyState description={m.jobs.emptyDescription} obake="hatsukoe" title={m.jobs.emptyTitle} />;
  }
  const { formatDate, formatTimeRange, formatYen } = createFormatters(locale);
  const showStore = stores.length > 1;
  const sorted = [...jobs].sort((left, right) => {
    const byStatus = statusOrder[left.status] - statusOrder[right.status];
    if (byStatus !== 0) return byStatus;
    const byStart = Date.parse(left.startsAt) - Date.parse(right.startsAt);
    return left.status === "closed" ? -byStart : byStart;
  });

  return (
    <div className="tableCard">
      <table>
        <thead>
          <tr>
            <th>{m.jobs.columns.job}</th>
            {showStore ? <th>{m.jobs.columns.store}</th> : null}
            <th>{m.jobs.columns.when}</th>
            <th>{m.jobs.columns.applicants}</th>
            <th>{m.jobs.columns.wage}</th>
            <th>{m.jobs.columns.status}</th>
            <th><span className="visuallyHidden">{m.jobs.columns.actions}</span></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((job) => {
            const jobApplications = applications.filter((application) => application.jobPostingId === job.id);
            const selected = jobApplications.filter((application) => application.status === "selected").length;
            const pending = jobApplications.filter((application) => application.status === "applied").length;
            return (
              <tr className={job.id === highlightId ? "highlightRow" : undefined} id={`job-${job.id}`} key={job.id}>
                <td>
                  <strong>
                    {job.urgent ? <span className="status status-urgent">{m.jobs.urgent}</span> : null}
                    {job.title}
                  </strong>
                  <span>{m.labels.role[job.role]}</span>
                </td>
                {showStore ? <td>{stores.find((store) => store.id === job.storeId)?.name ?? job.storeId}</td> : null}
                <td>
                  {formatDate(job.startsAt)}
                  <span>{formatTimeRange(job.startsAt, job.endsAt)}</span>
                </td>
                <td>
                  {fill(m.jobs.hired, { selected, capacity: job.capacity })}
                  <span>
                    {pending > 0 ? (
                      <Link className="inlineLink" href="/applications">{fill(m.jobs.pending, { count: pending })}</Link>
                    ) : (
                      fill(m.jobs.applied, { count: jobApplications.length })
                    )}
                  </span>
                </td>
                <td>{formatYen(job.hourlyWage)}</td>
                <td><span className={`status status-${job.status}`}>{m.labels.jobStatus[job.status]}</span></td>
                <td className="actionCell">
                  <div className="rowActions">
                    {canManage ? (
                      <Link className="button button-ghost" href={`/jobs/new?from=${encodeURIComponent(job.id)}`}>{m.jobs.duplicate}</Link>
                    ) : null}
                    {canManage && job.status === "draft" ? (
                      <ActionForm action={publishJobAction} className="inlineAction">
                        <input name="jobId" type="hidden" value={job.id} />
                        <SubmitButton pendingLabel={m.common.publishing}>{fill(m.jobs.publish, { xp: publishExperience })}</SubmitButton>
                      </ActionForm>
                    ) : null}
                    {canManage && job.status === "published" ? (
                      <ActionForm action={closeJobAction} className="inlineAction">
                        <input name="jobId" type="hidden" value={job.id} />
                        <SubmitButton pendingLabel={m.common.closing} variant="secondary">{m.jobs.close}</SubmitButton>
                      </ActionForm>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
