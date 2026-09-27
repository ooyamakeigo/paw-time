import type { Application, Invitation, JobPosting, WorkerHistory } from "@paw-time/api-contracts";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { fill, type Messages } from "@/lib/i18n/messages";
import { inviteWorkerAction } from "./actions";

type InvitePanelProps = {
  job: JobPosting;
  applications: Application[];
  invitations: Invitation[];
  histories: WorkerHistory[];
  openings: number;
  canManage: boolean;
  m: Messages;
};

/** For an urgent job: the people who have worked here, with one tap to let them know. */
export function InvitePanel({ job, applications, invitations, histories, openings, canManage, m }: InvitePanelProps) {
  const applied = new Set(applications.filter((application) => application.jobPostingId === job.id).map((application) => application.workerId));
  const jobInvitations = invitations.filter((invitation) => invitation.jobPostingId === job.id);
  const invitedIds = new Set(jobInvitations.map((invitation) => invitation.workerId));
  // Past workers who have not applied on their own, plus anyone already invited so their answer stays visible.
  const candidates = histories
    .filter((history) => history.completedShifts > 0 && (!applied.has(history.workerId) || invitedIds.has(history.workerId)))
    .sort((left, right) => right.completedShifts - left.completedShifts || (right.averageRating ?? 0) - (left.averageRating ?? 0));
  const t = m.applications.invite;
  return (
    <section className="invitePanel">
      <div className="invitePanelHead">
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h3>{t.title}</h3>
          <p className="hint">{t.description}</p>
        </div>
        <span className={`capacity${openings === 0 ? " capacity-full" : ""}`}>{fill(t.openings, { count: openings })}</span>
      </div>
      {candidates.length === 0 ? (
        <p className="hint">{t.none}</p>
      ) : (
        <ul className="inviteList" role="list">
          {candidates.map((history) => {
            const invitation = jobInvitations.find((candidate) => candidate.workerId === history.workerId);
            return (
              <li key={history.workerId}>
                <Avatar name={history.displayName} seed={history.workerId} />
                <div className="inviteWho">
                  <strong>{history.displayName}</strong>
                  <small>
                    {fill(m.applications.history.shifts, { count: history.completedShifts })}
                    {history.averageRating !== null ? ` ・ ${fill(m.applications.history.rating, { rating: history.averageRating.toFixed(1) })}` : ""}
                  </small>
                </div>
                {invitation ? (
                  <span className={`status status-invite-${invitation.status}`}>{m.labels.invitationStatus[invitation.status]}</span>
                ) : canManage && openings > 0 ? (
                  <ActionForm action={inviteWorkerAction} className="inlineAction">
                    <input name="jobId" type="hidden" value={job.id} />
                    <input name="workerId" type="hidden" value={history.workerId} />
                    <SubmitButton pendingLabel={m.common.sending} variant="secondary">{t.button}</SubmitButton>
                  </ActionForm>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
