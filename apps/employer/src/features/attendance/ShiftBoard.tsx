import type {
  Application,
  AttendanceEvent,
  AttendanceEventKind,
  AttendanceSummary,
  ClosedPeriod,
  Evaluation,
  JobPosting,
  Shift,
} from "@paw-time/api-contracts";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { createFormatters, dateKey, HOUR, monthKey, todayKey, type Formatters } from "@/lib/format";
import { fill, type Locale, type Messages } from "@/lib/i18n/messages";
import { attendanceAlerts, attendanceKindLabel, punctualityLabel, sourceLabel } from "@/lib/labels";
import { confirmShiftAction, createUrgentJobAction, markNoShowAction, recordAttendanceAction } from "./actions";
import { CorrectionForm } from "./CorrectionForm";

type ShiftBoardProps = {
  shifts: Shift[];
  summaries: AttendanceSummary[];
  events: AttendanceEvent[];
  applications: Application[];
  jobs: JobPosting[];
  evaluations: Evaluation[];
  closedPeriods: ClosedPeriod[];
  confirmExperience: number;
  canManage: boolean;
  now: Date;
  m: Messages;
  locale: Locale;
};

export function ShiftBoard({
  shifts,
  summaries,
  events,
  applications,
  jobs,
  evaluations,
  closedPeriods,
  confirmExperience,
  canManage,
  now,
  m,
  locale,
}: ShiftBoardProps) {
  if (shifts.length === 0) {
    return <EmptyState description={m.attendance.emptyDescription} title={m.attendance.emptyTitle} />;
  }
  const f = createFormatters(locale);
  const today = todayKey(now);
  const byStart = (left: Shift, right: Shift) => Date.parse(left.scheduledStartAt) - Date.parse(right.scheduledStartAt);
  const sections = [
    { title: m.attendance.sections.today, shifts: shifts.filter((shift) => dateKey(shift.scheduledStartAt) === today).sort(byStart) },
    { title: m.attendance.sections.upcoming, shifts: shifts.filter((shift) => dateKey(shift.scheduledStartAt) > today).sort(byStart) },
    {
      title: m.attendance.sections.past,
      shifts: shifts.filter((shift) => dateKey(shift.scheduledStartAt) < today).sort((left, right) => byStart(right, left)),
    },
  ].filter((section) => section.shifts.length > 0);
  const isClosed = (shift: Shift) =>
    closedPeriods.some((period) => period.storeId === shift.storeId && period.month === monthKey(shift.scheduledStartAt));

  return (
    <div className="groupList">
      {sections.map((section) => (
        <section key={section.title}>
          <h2 className="sectionTitle">{section.title}</h2>
          <div className="cardGrid">
            {section.shifts.map((shift) => (
              <ShiftRow
                application={applications.find((application) => application.id === shift.applicationId)}
                canManage={canManage}
                closed={isClosed(shift)}
                confirmExperience={confirmExperience}
                evaluated={evaluations.some((evaluation) => evaluation.shiftId === shift.id)}
                events={events.filter((event) => event.shiftId === shift.id)}
                f={f}
                job={jobs.find((job) => job.id === shift.jobPostingId)}
                key={shift.id}
                m={m}
                now={now}
                shift={shift}
                summary={summaries.find((summary) => summary.shiftId === shift.id)}
                urgentJob={jobs.find((job) => job.urgent && job.description.includes(`[shift:${shift.id}]`))}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

type ShiftRowProps = {
  shift: Shift;
  summary: AttendanceSummary | undefined;
  events: AttendanceEvent[];
  application: Application | undefined;
  job: JobPosting | undefined;
  urgentJob: JobPosting | undefined;
  evaluated: boolean;
  closed: boolean;
  canManage: boolean;
  confirmExperience: number;
  now: Date;
  m: Messages;
  f: Formatters;
};

function ShiftRow({
  shift,
  summary,
  events,
  application,
  job,
  urgentJob,
  evaluated,
  closed,
  canManage,
  confirmExperience,
  now,
  m,
  f,
}: ShiftRowProps) {
  const punctuality = punctualityLabel(summary, m);
  const alerts = attendanceAlerts(summary, m);
  const started = now.getTime() >= Date.parse(shift.scheduledStartAt);
  const notOver = now.getTime() < Date.parse(shift.scheduledEndAt) - 30 * 60_000;
  const onBreak = summary?.onBreak ?? false;
  const worked = shift.status === "checked_out" || shift.status === "completed";
  const superseded = new Set(events.map((event) => event.correctionOfEventId).filter((id): id is string => id !== null));
  const effective = events.filter((event) => !superseded.has(event.id));
  const lastBreakStart = [...effective].reverse().find((event) => event.kind === "break_start");
  const workerPunched = effective.some((event) => event.source === "worker");
  const canCorrect = canManage && !closed && shift.status !== "scheduled" && shift.status !== "no_show" && shift.status !== "cancelled";
  const canPunch = !closed;

  return (
    <article className={`shiftRow${alerts.length > 0 ? " shiftRow-alert" : ""}${closed ? " shiftRow-closed" : ""}`} id={`shift-${shift.id}`}>
      <div className="shiftMain">
        <div className="shiftWho">
          <Avatar name={application?.workerDisplayName ?? "?"} seed={shift.workerId} />
          <div>
            <h3>{application?.workerDisplayName ?? m.attendance.fallbackWorker}</h3>
            <p>{job?.title ?? m.attendance.fallbackJob}</p>
          </div>
        </div>
        <dl className="shiftTimes">
          <div><dt>{m.attendance.plan}</dt><dd>{f.formatDate(shift.scheduledStartAt)} {f.formatTimeRange(shift.scheduledStartAt, shift.scheduledEndAt)}</dd></div>
          <div><dt>{m.attendance.checkIn}</dt><dd>{summary?.actualCheckInAt ? f.formatTime(summary.actualCheckInAt) : m.common.none}</dd></div>
          <div><dt>{m.attendance.checkOut}</dt><dd>{summary?.actualCheckOutAt ? f.formatTime(summary.actualCheckOutAt) : m.common.none}</dd></div>
        </dl>
        <div className="shiftBadges">
          <span className={`status status-shift-${shift.status}`}>{m.labels.shiftStatus[shift.status]}</span>
          {closed ? <span className="status status-closed">🔒 {m.attendance.closed}</span> : null}
          {onBreak ? <span className="status status-break">{m.attendance.onBreak}</span> : null}
          {punctuality ? <span className={`status status-${summary?.punctuality}`}>{punctuality}</span> : null}
          {workerPunched && shift.status === "checked_out" ? <span className="status status-worker">{m.attendance.punchedBy.worker}</span> : null}
          {summary && summary.correctionCount > 0 ? (
            <span className="status">{fill(m.attendance.corrected, { count: summary.correctionCount })}</span>
          ) : null}
        </div>
        <div className="shiftActions">
          {shift.status === "scheduled" && canPunch ? (
            <>
              <AttendanceForm f={f} kinds={["check_in"]} m={m} moment={defaultMoment(shift, "check_in", now, lastBreakStart)} shift={shift} />
              {started && canManage ? (
                <ActionForm action={markNoShowAction} className="inlineAction">
                  <input name="shiftId" type="hidden" value={shift.id} />
                  <SubmitButton pendingLabel={m.common.recording} variant="ghost">{m.attendance.noShow}</SubmitButton>
                </ActionForm>
              ) : null}
            </>
          ) : null}
          {shift.status === "checked_in" && canPunch ? (
            onBreak ? (
              <AttendanceForm f={f} kinds={["break_end"]} m={m} moment={defaultMoment(shift, "break_end", now, lastBreakStart)} shift={shift} />
            ) : (
              <AttendanceForm f={f} kinds={["break_start", "check_out"]} m={m} moment={defaultMoment(shift, "check_out", now, lastBreakStart)} shift={shift} />
            )
          ) : null}
          {shift.status === "checked_out" && canManage && !closed ? (
            <ActionForm action={confirmShiftAction} className="inlineAction">
              <input name="shiftId" type="hidden" value={shift.id} />
              <SubmitButton pendingLabel={m.common.confirming}>
                {fill(workerPunched ? m.attendance.approve : m.attendance.confirm, { xp: confirmExperience })}
              </SubmitButton>
            </ActionForm>
          ) : null}
          {(shift.status === "no_show" || shift.status === "cancelled") && canManage && notOver ? (
            urgentJob ? (
              <Link className="inlineLink" href={`/applications#job-${urgentJob.id}`}>{m.jobs.urgent} →</Link>
            ) : (
              <ActionForm action={createUrgentJobAction} className="inlineAction">
                <input name="shiftId" type="hidden" value={shift.id} />
                <SubmitButton pendingLabel={m.common.publishing} variant="danger">{m.attendance.urgentFill}</SubmitButton>
              </ActionForm>
            )
          ) : null}
          {shift.status === "completed" && !evaluated ? (
            <Link className="inlineLink" href="/evaluations">{m.attendance.reviewLink}</Link>
          ) : null}
        </div>
      </div>
      {closed ? <p className="hint closedHint">{m.attendance.closedHint}</p> : null}
      {alerts.length > 0 ? (
        <ul className="alertChips" role="list">
          {alerts.map((alert) => (
            <li key={alert}>
              <span aria-hidden="true">!</span>
              {alert}
            </li>
          ))}
        </ul>
      ) : null}
      {worked && summary ? (
        <dl className="shiftMetrics">
          <div><dt>{m.attendance.metrics.worked}</dt><dd>{f.formatMinutes(summary.workedMinutes)}</dd></div>
          <div><dt>{m.attendance.metrics.break}</dt><dd>{f.formatMinutes(summary.breakMinutes)}</dd></div>
          <div className={summary.overtimeMinutes > 0 ? "metric-hot" : undefined}><dt>{m.attendance.metrics.overtime}</dt><dd>{f.formatMinutes(summary.overtimeMinutes)}</dd></div>
          <div className={summary.nightMinutes > 0 ? "metric-hot" : undefined}><dt>{m.attendance.metrics.night}</dt><dd>{f.formatMinutes(summary.nightMinutes)}</dd></div>
          <div className="metric-pay"><dt>{m.attendance.metrics.pay}</dt><dd>{f.formatYen(summary.estimatedPay)}</dd></div>
        </dl>
      ) : null}
      {events.length > 0 ? (
        <details className="punchLog">
          <summary>{fill(m.attendance.log.summary, { count: events.length })}</summary>
          <ol className="punchList">
            {[...events]
              .sort((left, right) => Date.parse(left.recordedAt) - Date.parse(right.recordedAt))
              .map((event) => {
                const old = superseded.has(event.id);
                return (
                  <li className={old ? "punch punch-old" : "punch"} key={event.id}>
                    <div className="punchHead">
                      <strong>{attendanceKindLabel(event.kind, m)}</strong>
                      <span className="punchTime">{f.formatDateTime(event.recordedAt)}</span>
                      <small>
                        {fill(m.attendance.log.by, { source: sourceLabel(event.source, m) })}
                        {old ? ` ・ ${m.attendance.log.superseded}` : ""}
                      </small>
                    </div>
                    {event.note ? <p className="punchNote">{m.attendance.log.reason}: {event.note}</p> : null}
                    {canCorrect && !old ? (
                      <CorrectionForm
                        date={dateKey(event.recordedAt)}
                        eventId={event.id}
                        shiftId={shift.id}
                        time={f.formatTime(event.recordedAt)}
                      />
                    ) : null}
                  </li>
                );
              })}
          </ol>
        </details>
      ) : null}
    </article>
  );
}

type AttendanceFormProps = { shift: Shift; kinds: AttendanceEventKind[]; moment: Date; m: Messages; f: Formatters };

const buttonLabel: Record<AttendanceEventKind, keyof Messages["attendance"]> = {
  check_in: "recordCheckIn",
  check_out: "recordCheckOut",
  break_start: "startBreak",
  break_end: "endBreak",
};

/** One date and time, and a button per punch kind that is allowed right now. */
function AttendanceForm({ shift, kinds, moment, m, f }: AttendanceFormProps) {
  return (
    <ActionForm action={recordAttendanceAction} className="attendanceForm">
      <input name="shiftId" type="hidden" value={shift.id} />
      <input name="clientRequestId" type="hidden" value={crypto.randomUUID()} />
      <label className="field compactField">
        <span className="visuallyHidden">{m.attendance.date}</span>
        <input defaultValue={dateKey(moment)} name="date" required type="date" />
      </label>
      <label className="field compactField">
        <span className="visuallyHidden">{m.attendance.time}</span>
        <input defaultValue={f.formatTime(moment)} name="time" required type="time" />
      </label>
      <div className="attendanceButtons">
        {kinds.map((kind) => (
          <SubmitButton
            key={kind}
            name="kind"
            pendingLabel={m.common.recording}
            value={kind}
            variant={kind === "break_start" ? "secondary" : "primary"}
          >
            {String(m.attendance[buttonLabel[kind]])}
          </SubmitButton>
        ))}
      </div>
    </ActionForm>
  );
}

/** The current time while the shift is under way; otherwise a sensible time inside the shift. */
function defaultMoment(shift: Shift, kind: AttendanceEventKind, now: Date, lastBreakStart: AttendanceEvent | undefined): Date {
  const start = Date.parse(shift.scheduledStartAt);
  const end = Date.parse(shift.scheduledEndAt);
  if (now.getTime() >= start - 2 * HOUR && now.getTime() <= end + 2 * HOUR) return now;
  switch (kind) {
    case "check_in":
      return new Date(start);
    case "check_out":
      return new Date(end);
    case "break_start":
      return new Date(start + (end - start) / 2);
    case "break_end":
      return new Date(lastBreakStart ? Date.parse(lastBreakStart.recordedAt) + 30 * 60_000 : start + (end - start) / 2 + 30 * 60_000);
  }
}
