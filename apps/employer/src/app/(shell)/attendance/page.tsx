import Link from "next/link";
import { ApiUnavailable } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { ShiftBoard } from "@/features/attendance/ShiftBoard";
import {
  getMe,
  listApplications,
  listAttendanceEvents,
  listAttendanceSummaries,
  listClosedPeriods,
  listEvaluations,
  listJobs,
  listShifts,
} from "@/lib/api";
import { monthKey } from "@/lib/format";
import { getMessages } from "@/lib/i18n/server";
import { rewardExperience } from "@/lib/island";
import { scopeToStore } from "@/lib/scope";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const now = new Date();
  const [{ locale, m }, session, me, allShifts, summaries, events, applications, allJobs, evaluations, closedPeriods] =
    await Promise.all([
      getMessages(),
      getSession(),
      getMe(),
      listShifts(),
      listAttendanceSummaries(),
      listAttendanceEvents(),
      listApplications(),
      listJobs(),
      listEvaluations(),
      listClosedPeriods(),
    ]);
  const { jobs, shifts } = scopeToStore(session.storeId, { jobs: allJobs ?? [], shifts: allShifts ?? [] });
  return (
    <>
      <PageHeader
        action={
          <div className="headerTools">
            <Link className="button button-ghost" href="/kiosk">{m.attendance.kioskLink}</Link>
            <form action="/attendance/export" aria-label={m.attendance.export.label} className="exportForm" method="get">
              <label className="field compactField">
                <span className="visuallyHidden">{m.attendance.export.month}</span>
                <input defaultValue={monthKey(now)} name="month" type="month" />
              </label>
              <label className="field compactField">
                <span className="visuallyHidden">{m.attendance.export.format}</span>
                <select name="format">
                  <option value="daily">{m.attendance.export.daily}</option>
                  <option value="monthly">{m.attendance.export.monthly}</option>
                </select>
              </label>
              <button className="button button-secondary" type="submit">{m.attendance.export.submit}</button>
            </form>
          </div>
        }
        description={m.attendance.description}
        eyebrow={m.attendance.eyebrow}
        obake="asatsuyu"
        title={m.attendance.title}
      />
      {allShifts && summaries && events && applications && allJobs && evaluations && closedPeriods && me ? (
        <ShiftBoard
          applications={applications}
          canManage={me.member.role === "manager"}
          closedPeriods={closedPeriods}
          confirmExperience={rewardExperience("attendance_confirmed")}
          evaluations={evaluations}
          events={events}
          jobs={jobs.length > 0 || session.storeId ? jobs : allJobs}
          locale={locale}
          m={m}
          now={now}
          shifts={shifts}
          summaries={summaries}
        />
      ) : (
        <ApiUnavailable m={m} />
      )}
    </>
  );
}
