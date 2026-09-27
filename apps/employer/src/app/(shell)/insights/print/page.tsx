import { ApiUnavailable } from "@/components/EmptyState";
import { ManagerOnly } from "@/components/ManagerOnly";
import { PrintButton } from "@/components/PrintButton";
import { getInsights, getMe, listApplications, listAttendanceSummaries, listJobs, listShifts } from "@/lib/api";
import { createFormatters, dateKey, shiftDateKey, todayKey, weekStartKey } from "@/lib/format";
import { fill } from "@/lib/i18n/messages";
import { getMessages } from "@/lib/i18n/server";
import { payLine } from "@/lib/payroll";
import { scopeToStore } from "@/lib/scope";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** One page for the manager's meeting: this week's shifts, cost and signals. Prints to PDF from the browser. */
export default async function WeeklyPrintPage() {
  const now = new Date();
  const [{ locale, m }, session, me, allShifts, summaries, allJobs, applications] = await Promise.all([
    getMessages(),
    getSession(),
    getMe(),
    listShifts(),
    listAttendanceSummaries(),
    listJobs(),
    listApplications(),
  ]);
  if (!me || !allShifts || !summaries || !allJobs || !applications) return <ApiUnavailable m={m} />;
  if (me.member.role !== "manager") return <ManagerOnly m={m} />;
  const report = await getInsights(session.storeId, 7);
  const f = createFormatters(locale);
  const t = m.insights;
  const weekStart = weekStartKey(todayKey(now));
  const weekEnd = shiftDateKey(weekStart, 6);
  const { jobs, shifts } = scopeToStore(session.storeId, { jobs: allJobs, shifts: allShifts });
  const weekShifts = shifts
    .filter((shift) => dateKey(shift.scheduledStartAt) >= weekStart && dateKey(shift.scheduledStartAt) <= weekEnd)
    .sort((left, right) => Date.parse(left.scheduledStartAt) - Date.parse(right.scheduledStartAt));
  const lines = weekShifts
    .map((shift) =>
      payLine(
        shift,
        summaries.find((summary) => summary.shiftId === shift.id),
        (jobs.length > 0 ? jobs : allJobs).find((job) => job.id === shift.jobPostingId),
        applications.find((application) => application.id === shift.applicationId)?.workerDisplayName ?? m.attendance.fallbackWorker,
      ),
    )
    .filter((line): line is NonNullable<typeof line> => line !== null);
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const people = new Set(weekShifts.filter((shift) => shift.status === "completed").map((shift) => shift.workerId)).size;
  const store = me.stores.find((candidate) => candidate.id === session.storeId);

  return (
    <article className="printSheet">
      <header className="printHead">
        <div>
          <p className="eyebrow">{t.printEyebrow}</p>
          <h1>{fill(t.printTitle, { store: store?.name ?? m.app.allStores, range: fill(m.calendar.weekOf, { start: f.formatShortDate(`${weekStart}T12:00:00+09:00`), end: f.formatShortDate(`${weekEnd}T12:00:00+09:00`) }) })}</h1>
          <p className="hint">{fill(t.printedAt, { date: f.formatDateTime(now) })}</p>
        </div>
        <PrintButton label={m.app.print} />
      </header>
      <section className="printStats">
        <div><span>{t.weekShifts}</span><strong>{weekShifts.length}</strong></div>
        <div><span>{t.weekPayroll}</span><strong>{f.formatYen(total)}</strong></div>
        <div><span>{t.weekNew}</span><strong>{people}</strong></div>
        {report ? (
          <>
            <div><span>{t.kpis.nextDayOpenRate}</span><strong>{f.formatPercent(report.nextDayOpenRate)}</strong></div>
            <div><span>{t.kpis.returnRate}</span><strong>{f.formatPercent(report.returnRate)}</strong></div>
            <div><span>{t.kpis.fillRate}</span><strong>{f.formatPercent(report.fillRate)}</strong></div>
          </>
        ) : null}
      </section>
      <div className="tableCard printTable">
      <table className="compactTable">
        <thead>
          <tr>
            <th>{m.attendance.date}</th>
            <th>{m.workers.columns.worker}</th>
            <th>{m.jobs.columns.job}</th>
            <th>{m.attendance.plan}</th>
            <th>{m.attendance.checkIn}</th>
            <th>{m.attendance.checkOut}</th>
            <th>{m.jobs.columns.status}</th>
            <th className="numeric">{m.attendance.metrics.pay}</th>
          </tr>
        </thead>
        <tbody>
          {weekShifts.map((shift) => {
            const summary = summaries.find((candidate) => candidate.shiftId === shift.id);
            return (
              <tr key={shift.id}>
                <td>{f.formatShortDate(shift.scheduledStartAt)}</td>
                <td>{applications.find((application) => application.id === shift.applicationId)?.workerDisplayName ?? m.attendance.fallbackWorker}</td>
                <td>{allJobs.find((job) => job.id === shift.jobPostingId)?.title ?? ""}</td>
                <td>{f.formatTimeRange(shift.scheduledStartAt, shift.scheduledEndAt)}</td>
                <td>{summary?.actualCheckInAt ? f.formatTime(summary.actualCheckInAt) : m.common.none}</td>
                <td>{summary?.actualCheckOutAt ? f.formatTime(summary.actualCheckOutAt) : m.common.none}</td>
                <td>{m.labels.shiftStatus[shift.status]}</td>
                <td className="numeric">{summary && summary.estimatedPay > 0 ? f.formatYen(summary.estimatedPay) : m.common.none}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </article>
  );
}
