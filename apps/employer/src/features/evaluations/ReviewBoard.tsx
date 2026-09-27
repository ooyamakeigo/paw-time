import type { Application, AttendanceSummary, Evaluation, JobPosting, Letter, Shift } from "@paw-time/api-contracts";
import { LETTER_TEMPLATES } from "@paw-time/api-contracts/letters";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { createFormatters } from "@/lib/format";
import { fill, type Locale, type Messages } from "@/lib/i18n/messages";
import { evaluationTagLabel, punctualityLabel } from "@/lib/labels";
import { ReviewForm } from "./ReviewForm";

type ReviewBoardProps = {
  shifts: Shift[];
  evaluations: Evaluation[];
  letters: Letter[];
  applications: Application[];
  jobs: JobPosting[];
  summaries: AttendanceSummary[];
  evaluationExperience: number;
  letterExperience: number;
  m: Messages;
  locale: Locale;
};

/** Preset letters are shown in the screen's language; free text as written. */
function letterText(letter: Letter, locale: Locale): string {
  const preset = LETTER_TEMPLATES.find((template) => template.code === letter.template);
  return preset ? preset[locale] : letter.body;
}

export function ReviewBoard({
  shifts,
  evaluations,
  letters,
  applications,
  jobs,
  summaries,
  evaluationExperience,
  letterExperience,
  m,
  locale,
}: ReviewBoardProps) {
  const { formatDate, formatDateTime, formatTimeRange } = createFormatters(locale);
  const workerName = (shift: Shift | undefined) =>
    applications.find((application) => application.id === shift?.applicationId)?.workerDisplayName ?? m.attendance.fallbackWorker;
  const jobTitle = (shift: Shift | undefined) =>
    jobs.find((job) => job.id === shift?.jobPostingId)?.title ?? m.attendance.fallbackJob;

  const awaiting = shifts
    .filter((shift) => shift.status === "completed")
    .filter((shift) => !evaluations.some((evaluation) => evaluation.shiftId === shift.id))
    .sort((left, right) => Date.parse(right.scheduledStartAt) - Date.parse(left.scheduledStartAt));
  const sent = [...evaluations].sort((left, right) => Date.parse(right.submittedAt) - Date.parse(left.submittedAt));

  return (
    <div className="groupList">
      <section>
        <h2 className="sectionTitle">{m.reviews.awaiting}</h2>
        {awaiting.length === 0 ? (
          <EmptyState description={m.reviews.emptyDescription} obake="hirunen" title={m.reviews.emptyTitle} />
        ) : (
          <div className="cardGrid">
            {awaiting.map((shift) => {
              const summary = summaries.find((candidate) => candidate.shiftId === shift.id);
              const punctuality = punctualityLabel(summary, m);
              return (
                <article className="panel reviewCard" key={shift.id}>
                  <header className="evaluationHeader">
                    <Avatar name={workerName(shift)} seed={shift.workerId} />
                    <div>
                      <h3>{workerName(shift)}</h3>
                      <p>{jobTitle(shift)} · {formatDate(shift.scheduledStartAt)} {formatTimeRange(shift.scheduledStartAt, shift.scheduledEndAt)}</p>
                    </div>
                    {punctuality ? (
                      <span className={`status status-${summary?.punctuality} headerBadge`}>{punctuality}</span>
                    ) : null}
                  </header>
                  <ReviewForm
                    evaluationExperience={evaluationExperience}
                    letterExperience={letterExperience}
                    shiftId={shift.id}
                    workerId={shift.workerId}
                  />
                </article>
              );
            })}
          </div>
        )}
      </section>
      {sent.length > 0 ? (
        <section>
          <h2 className="sectionTitle">{m.reviews.sent}</h2>
          <div className="cardGrid">
            {sent.map((evaluation) => {
              const shift = shifts.find((candidate) => candidate.id === evaluation.shiftId);
              const shiftLetters = letters
                .filter((letter) => letter.shiftId === evaluation.shiftId)
                .sort((left, right) => Date.parse(left.sentAt) - Date.parse(right.sentAt));
              return (
                <article className="personCard" key={evaluation.id}>
                  <Avatar name={workerName(shift)} seed={evaluation.subjectId} />
                  <div className="personBody">
                    <h3>{workerName(shift)}</h3>
                    <p>{jobTitle(shift)} · {fill(m.reviews.sentAt, { time: formatDateTime(evaluation.submittedAt) })}</p>
                    {evaluation.tags.length > 0 ? (
                      <ul className="tagList">
                        {evaluation.tags.map((tag) => <li key={tag}>{evaluationTagLabel(tag, m)}</li>)}
                      </ul>
                    ) : null}
                    {evaluation.comment ? <p className="comment">{evaluation.comment}</p> : null}
                    {shiftLetters.map((letter) => (
                      <div className="letterThread" key={letter.id}>
                        <p className="letterBubble">{letterText(letter, locale)}</p>
                        {letter.replyStamp ? (
                          <p className={`stamp stamp-${letter.replyStamp}`}>
                            <img alt="" height={28} src="/obake/morattan.webp" width={28} />
                            {fill(m.reviews.reply, { stamp: m.labels.stamp[letter.replyStamp] })}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <span aria-label={fill(m.reviews.stars, { count: evaluation.rating })} className="stars">
                    {"★".repeat(evaluation.rating)}
                    <span className="starsOff">{"★".repeat(5 - evaluation.rating)}</span>
                  </span>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
