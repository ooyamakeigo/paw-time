import type { Application, AttendanceSummary, Evaluation, GameWorld, JobPosting, Letter, Shift } from "@paw-time/api-contracts";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { dismissOnboardingAction } from "@/features/session/actions";
import { createFormatters, dateKey, monthKey, todayKey } from "@/lib/format";
import { fill, type Locale, type Messages } from "@/lib/i18n/messages";
import { islandProgress, islandResident, rewardExperience } from "@/lib/island";
import { islandItemLabel, punctualityLabel } from "@/lib/labels";
import { monthPayroll } from "@/lib/payroll";

type DashboardProps = {
  jobs: JobPosting[];
  applications: Application[];
  shifts: Shift[];
  summaries: AttendanceSummary[];
  /** Reviews and letters are optional: the dashboard still renders when those calls fail. */
  evaluations?: Evaluation[] | null | undefined;
  letters?: Letter[] | null | undefined;
  world: GameWorld;
  canManage: boolean;
  onboardingDismissed: boolean;
  now: Date;
  m: Messages;
  locale: Locale;
};

type NextAction = { title: string; description: string; href: string; label: string };

const flowHrefs = ["/jobs", "/applications", "/attendance", "/evaluations", "/island"] as const;

export function Dashboard({
  jobs,
  applications,
  shifts,
  summaries,
  evaluations = [],
  letters = [],
  world,
  canManage,
  onboardingDismissed,
  now,
  m,
  locale,
}: DashboardProps) {
  const reviews = evaluations ?? [];
  const mail = letters ?? [];
  const f = createFormatters(locale);
  const today = todayKey(now);
  const publishedJobs = jobs.filter((job) => job.status === "published");
  const pendingApplications = applications.filter((application) => application.status === "applied");
  const todayShifts = shifts
    .filter((shift) => dateKey(shift.scheduledStartAt) === today)
    .sort((left, right) => Date.parse(left.scheduledStartAt) - Date.parse(right.scheduledStartAt));
  const awaitingConfirmation = shifts.filter((shift) => shift.status === "checked_out");
  const awaitingReview = shifts.filter(
    (shift) => shift.status === "completed" && !reviews.some((evaluation) => evaluation.shiftId === shift.id),
  );
  const missingCheckIn = summaries.filter((summary) => summary.missingPunch === "check_in").length;
  const missingCheckOut = summaries.filter((summary) => summary.missingPunch === "check_out").length;
  const breakShortfall = summaries.filter(
    (summary) =>
      summary.breakShortfallMinutes > 0 &&
      shifts.some((shift) => shift.id === summary.shiftId && shift.status === "checked_out"),
  ).length;
  const openGaps = jobs.filter(
    (job) =>
      job.urgent &&
      job.status === "published" &&
      applications.filter((application) => application.jobPostingId === job.id && application.status === "selected").length < job.capacity,
  ).length;
  const progress = islandProgress(world);
  const nextUnlock = progress.nextLevel?.unlocks[0];
  const payroll = monthPayroll(monthKey(now), shifts, summaries, jobs, applications, m.attendance.fallbackWorker);
  const onboarding = [
    { key: "publish", done: jobs.some((job) => job.status !== "draft"), href: "/jobs/new" },
    { key: "decide", done: applications.some((application) => application.decidedAt !== null), href: "/applications" },
    { key: "punch", done: summaries.some((summary) => summary.actualCheckOutAt !== null), href: "/attendance" },
    { key: "confirm", done: shifts.some((shift) => shift.status === "completed"), href: "/attendance" },
    { key: "letter", done: mail.length > 0 && reviews.length > 0, href: "/evaluations" },
    { key: "island", done: world.experience > 0 && onboardingDismissed, href: "/island" },
  ] as const;
  const onboardingDone = onboarding.filter((step) => step.done).length;
  const showOnboarding = !onboardingDismissed && onboardingDone < onboarding.length;

  const metrics = [
    { key: "publishedJobs", value: publishedJobs.length, href: "/jobs" },
    { key: "pendingApplications", value: pendingApplications.length, href: "/applications" },
    { key: "todayShifts", value: todayShifts.length, href: "/attendance" },
    { key: "pendingReviews", value: awaitingReview.length, href: "/evaluations" },
  ] as const;

  const alerts = [
    { key: "missingCheckIn", count: missingCheckIn },
    { key: "missingCheckOut", count: missingCheckOut },
    { key: "breakShortfall", count: breakShortfall },
    { key: "awaitingConfirmation", count: awaitingConfirmation.length },
    { key: "openGaps", count: openGaps },
  ].filter((alert) => alert.count > 0) as Array<{ key: keyof Messages["home"]["alerts"]; count: number }>;

  const nextAction = chooseNextAction(
    {
      openGaps,
      missingPunches: missingCheckIn + missingCheckOut,
      awaitingConfirmation: awaitingConfirmation.length,
      pendingApplications: pendingApplications.length,
      awaitingReview: awaitingReview.length,
      publishedJobs: publishedJobs.length,
    },
    m,
  );

  return (
    <>
      <section className="metricGrid">
        {metrics.map((metric) => (
          <Link className="metricCard" href={metric.href} key={metric.key}>
            <span>{m.home.metrics[metric.key]}</span>
            <strong>{metric.value}<small>{m.home.units[metric.key]}</small></strong>
          </Link>
        ))}
      </section>
      {alerts.length > 0 ? (
        <section aria-label={m.home.alertsTitle} className="alertStrip">
          <strong>{m.home.alertsTitle}</strong>
          <ul role="list">
            {alerts.map((alert) => (
              <li key={alert.key}>
                <Link href={alert.key === "openGaps" ? "/applications" : "/attendance"}>{fill(m.home.alerts[alert.key], { count: alert.count })}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {showOnboarding ? (
        <section className="panel onboarding">
          <div className="onboardingHead">
            <div>
              <p className="eyebrow">{m.home.onboardingTitle}</p>
              <h2>{fill(m.home.onboardingProgress, { done: onboardingDone, total: onboarding.length })}</h2>
            </div>
            <form action={dismissOnboardingAction}>
              <button className="button button-ghost" type="submit">{m.home.onboardingDismiss}</button>
            </form>
          </div>
          <ol className="onboardingSteps" role="list">
            {onboarding.map((step) => (
              <li className={step.done ? "done" : undefined} key={step.key}>
                <span aria-hidden="true" className="check">{step.done ? "✓" : ""}</span>
                {step.done ? <span>{m.home.onboarding[step.key]}</span> : <Link href={step.href}>{m.home.onboarding[step.key]}</Link>}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <section className="twoColumns">
        <article className="panel">
          <p className="eyebrow">{m.home.nextAction}</p>
          <h2>{nextAction.title}</h2>
          <p>{nextAction.description}</p>
          <Link className="inlineLink" href={nextAction.href}>{nextAction.label} →</Link>
        </article>
        <article className="panel nightPanel islandPanel">
          <div aria-hidden="true" className="starfield" />
          <div>
            <p className="eyebrow eyebrow-gold">{fill(m.home.islandEyebrow, { level: progress.level })}</p>
            <h2>
              {nextUnlock ? fill(m.home.islandNext, { item: islandItemLabel(nextUnlock, m) }) : m.home.islandComplete}
            </h2>
            <div className="progress"><span style={{ width: `${progress.percent}%` }} /></div>
            <p>
              {progress.nextLevel ? fill(m.home.islandRemaining, { xp: progress.remaining }) : m.home.islandKeepGoing}
            </p>
            <Link className="inlineLink inlineLink-gold" href="/island">{m.home.islandView}</Link>
          </div>
          {nextUnlock ? (
            <img alt="" className="silhouette" height={120} src={`/obake/${islandResident[nextUnlock] ?? "nemurin"}.webp`} width={120} />
          ) : null}
        </article>
      </section>
      <section className="twoColumns">
        <article className="panel todayPanel">
          <p className="eyebrow">{m.home.todayEyebrow}</p>
          <h2>{m.home.todayTitle}</h2>
          {todayShifts.length === 0 ? (
            <p>{m.home.todayEmpty}</p>
          ) : (
            <ul className="todayList">
              {todayShifts.map((shift) => {
                const application = applications.find((candidate) => candidate.id === shift.applicationId);
                const job = jobs.find((candidate) => candidate.id === shift.jobPostingId);
                const summary = summaries.find((candidate) => candidate.shiftId === shift.id);
                const punctuality = punctualityLabel(summary, m);
                return (
                  <li key={shift.id}>
                    <strong>{f.formatTimeRange(shift.scheduledStartAt, shift.scheduledEndAt)}</strong>
                    <span className="todayWho">
                      <Avatar name={application?.workerDisplayName ?? "?"} seed={shift.workerId} />
                      <span>{application?.workerDisplayName ?? m.attendance.fallbackWorker}<small>{job?.title}</small></span>
                    </span>
                    <span className={`status status-shift-${shift.status}`}>
                      {summary?.onBreak ? m.attendance.onBreak : m.labels.shiftStatus[shift.status]}
                    </span>
                    {punctuality ? <small>{punctuality}</small> : null}
                  </li>
                );
              })}
            </ul>
          )}
          <Link className="inlineLink" href="/attendance">{m.home.todayOpen}</Link>
        </article>
        {canManage ? (
        <article className="panel payPanel">
          <p className="eyebrow">{m.home.payrollEyebrow}</p>
          <h2>{fill(m.home.payrollTitle, { amount: f.formatYen(payroll.totals.all) })}</h2>
          <div aria-hidden="true" className="payMini">
            {payroll.totals.confirmed > 0 ? (
              <span className="paySegment paySegment-confirmed" style={{ width: `${(payroll.totals.confirmed / Math.max(1, payroll.totals.all)) * 100}%` }} />
            ) : null}
            {payroll.totals.all - payroll.totals.confirmed > 0 ? (
              <span className="paySegment paySegment-projected" style={{ width: `${((payroll.totals.all - payroll.totals.confirmed) / Math.max(1, payroll.totals.all)) * 100}%` }} />
            ) : null}
          </div>
          <ul className="payLegend payLegend-inline" role="list">
            <li><i className="swatch swatch-confirmed" />{fill(m.home.payrollConfirmed, { amount: f.formatYen(payroll.totals.confirmed) })}</li>
            <li><i className="swatch swatch-projected" />{fill(m.home.payrollPending, { amount: f.formatYen(payroll.totals.all - payroll.totals.confirmed) })}</li>
          </ul>
          <p className="hint">{m.home.payrollHint}</p>
          <Link className="inlineLink" href="/payroll">{m.home.payrollView}</Link>
        </article>
        ) : null}
      </section>
      <section className="flowSection">
        <p className="eyebrow">{m.home.flowEyebrow}</p>
        <h2>{m.home.flowTitle}</h2>
        <ol className="loop" role="list">
          {m.home.flow.map((step, index) => (
            <li className={index >= 3 ? "step step-night" : "step"} key={step.title}>
              <Link href={flowHrefs[index] ?? "/"}>
                <b>{step.label}</b>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

function chooseNextAction(
  counts: {
    openGaps: number;
    missingPunches: number;
    awaitingConfirmation: number;
    pendingApplications: number;
    awaitingReview: number;
    publishedJobs: number;
  },
  m: Messages,
): NextAction {
  const actions = m.home.actions;
  if (counts.openGaps > 0) {
    return {
      ...actions.gaps,
      description: fill(actions.gaps.description, { count: counts.openGaps }),
      href: "/applications",
    };
  }
  if (counts.missingPunches > 0) {
    return {
      ...actions.missing,
      description: fill(actions.missing.description, { count: counts.missingPunches }),
      href: "/attendance",
    };
  }
  if (counts.awaitingConfirmation > 0) {
    return {
      ...actions.confirm,
      description: fill(actions.confirm.description, {
        count: counts.awaitingConfirmation,
        xp: rewardExperience("attendance_confirmed"),
      }),
      href: "/attendance",
    };
  }
  if (counts.pendingApplications > 0) {
    return {
      ...actions.applications,
      description: fill(actions.applications.description, { count: counts.pendingApplications }),
      href: "/applications",
    };
  }
  if (counts.awaitingReview > 0) {
    return {
      ...actions.reviews,
      description: fill(actions.reviews.description, { count: counts.awaitingReview }),
      href: "/evaluations",
    };
  }
  if (counts.publishedJobs === 0) return { ...actions.publish, href: "/jobs/new" };
  return { ...actions.calm, href: "/jobs" };
}
