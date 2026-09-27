import type { Application, Invitation, JobPosting, WorkerHistory } from "@paw-time/api-contracts";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { createFormatters, HOUR } from "@/lib/format";
import { fill, type Locale, type Messages } from "@/lib/i18n/messages";
import { bulkPassAction } from "./actions";
import { DecisionForm } from "./DecisionForm";
import { InvitePanel } from "./InvitePanel";
import { WorkHistory } from "./WorkHistory";

const IN_TIME_HOURS = 24;
const applicationOrder: Record<Application["status"], number> = { applied: 0, selected: 1, rejected: 2, withdrawn: 3 };

type ApplicationListProps = {
  applications: Application[];
  jobs: JobPosting[];
  histories: WorkerHistory[];
  invitations: Invitation[];
  inTimeExperience: number;
  canManage: boolean;
  now: Date;
  m: Messages;
  locale: Locale;
};

export function ApplicationList({
  applications,
  jobs,
  histories,
  invitations,
  inTimeExperience,
  canManage,
  now,
  m,
  locale,
}: ApplicationListProps) {
  const f = createFormatters(locale);
  const { formatDate, formatDateTime, formatElapsed, formatTimeRange } = f;
  const groups = jobs
    .map((job) => ({
      job,
      applications: applications
        .filter((application) => application.jobPostingId === job.id)
        .sort((left, right) => applicationOrder[left.status] - applicationOrder[right.status] || Date.parse(left.appliedAt) - Date.parse(right.appliedAt)),
    }))
    // Urgent open jobs show even before anyone applied, so the invite panel is reachable.
    .filter((group) => group.applications.length > 0 || (group.job.urgent && group.job.status === "published"))
    .sort((left, right) => {
      const leftUrgent = left.job.urgent && left.job.status === "published" ? 0 : 1;
      const rightUrgent = right.job.urgent && right.job.status === "published" ? 0 : 1;
      if (leftUrgent !== rightUrgent) return leftUrgent - rightUrgent;
      const leftPending = left.applications.some((application) => application.status === "applied") ? 0 : 1;
      const rightPending = right.applications.some((application) => application.status === "applied") ? 0 : 1;
      return leftPending - rightPending || Date.parse(left.job.startsAt) - Date.parse(right.job.startsAt);
    });

  if (groups.length === 0) {
    return <EmptyState description={m.applications.emptyDescription} obake="hatsukoe" title={m.applications.emptyTitle} />;
  }

  return (
    <div className="groupList">
      {groups.map(({ job, applications: jobApplications }) => {
        const selected = jobApplications.filter((application) => application.status === "selected").length;
        const pendingCount = jobApplications.filter((application) => application.status === "applied").length;
        const full = selected >= job.capacity;
        return (
          <section className="jobGroup" id={`job-${job.id}`} key={job.id}>
            <header className="jobGroupHeader">
              <div>
                <h2>
                  {job.urgent ? <span className="status status-urgent">{m.jobs.urgent}</span> : null}
                  {job.title}
                </h2>
                <p>{formatDate(job.startsAt)} {formatTimeRange(job.startsAt, job.endsAt)}</p>
              </div>
              <div className="jobGroupMeta">
                <span className={`status status-${job.status}`}>{m.labels.jobStatus[job.status]}</span>
                <span className={`capacity${full ? " capacity-full" : ""}`}>
                  {fill(m.jobs.hired, { selected, capacity: job.capacity })}
                </span>
              </div>
            </header>
            {job.urgent && job.status === "published" ? (
              <InvitePanel
                applications={applications}
                canManage={canManage}
                histories={histories}
                invitations={invitations}
                job={job}
                m={m}
                openings={Math.max(0, job.capacity - selected)}
              />
            ) : null}
            <div className="cardGrid">
              {jobApplications.map((application) => {
                const hoursLeft = IN_TIME_HOURS - (now.getTime() - Date.parse(application.appliedAt)) / HOUR;
                return (
                  <article className="personCard" id={`application-${application.id}`} key={application.id}>
                    <Avatar name={application.workerDisplayName} seed={application.workerId} />
                    <div className="personBody">
                      <h3>{application.workerDisplayName}</h3>
                      <p>
                        {fill(m.applications.applied, { elapsed: formatElapsed(application.appliedAt, now) })}
                        {application.status === "applied" && hoursLeft > 0 ? (
                          <span className="bonus">
                            {fill(m.applications.bonus, { hours: Math.ceil(hoursLeft), xp: inTimeExperience })}
                          </span>
                        ) : null}
                      </p>
                      {application.decidedAt ? (
                        <p>
                          {fill(m.applications.decided, {
                            time: formatDateTime(application.decidedAt),
                            status: m.labels.applicationStatus[application.status],
                          })}
                          {application.decisionNote ? `（${application.decisionNote}）` : ""}
                        </p>
                      ) : null}
                      <WorkHistory f={f} history={histories.find((history) => history.workerId === application.workerId)} m={m} />
                      {application.status === "applied" && canManage ? (
                        <DecisionForm applicationId={application.id} canSelect={job.status === "published" && !full} />
                      ) : null}
                    </div>
                    <span className={`status status-${application.status}`}>{m.labels.applicationStatus[application.status]}</span>
                  </article>
                );
              })}
            </div>
            {full && pendingCount > 0 ? (
              <div className="jobGroupFooter">
                <p className="hint">{m.applications.fullHint}</p>
                {canManage ? (
                  <ActionForm action={bulkPassAction} className="inlineAction">
                    <input name="jobId" type="hidden" value={job.id} />
                    <SubmitButton pendingLabel={m.common.recording} variant="secondary">
                      {fill(m.applications.bulkPass, { count: pendingCount })}
                    </SubmitButton>
                  </ActionForm>
                ) : null}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
