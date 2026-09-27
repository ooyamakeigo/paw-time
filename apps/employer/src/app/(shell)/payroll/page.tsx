import { ApiUnavailable } from "@/components/EmptyState";
import { ManagerOnly } from "@/components/ManagerOnly";
import { PageHeader } from "@/components/PageHeader";
import { MonthClose } from "@/features/payroll/MonthClose";
import { PayrollView } from "@/features/payroll/PayrollView";
import { getMe, listApplications, listAttendanceSummaries, listClosedPeriods, listJobs, listShifts } from "@/lib/api";
import { isMonthKey, monthKey } from "@/lib/format";
import { getMessages } from "@/lib/i18n/server";
import { monthPayroll } from "@/lib/payroll";
import { scopeToStore } from "@/lib/scope";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

type PayrollPageProps = { searchParams: Promise<{ month?: string }> };

export default async function PayrollPage({ searchParams }: PayrollPageProps) {
  const now = new Date();
  const [{ locale, m }, session, { month: requested }, me, allShifts, summaries, allJobs, applications, closedPeriods] =
    await Promise.all([
      getMessages(),
      getSession(),
      searchParams,
      getMe(),
      listShifts(),
      listAttendanceSummaries(),
      listJobs(),
      listApplications(),
      listClosedPeriods(),
    ]);
  const month = isMonthKey(requested) ? requested : monthKey(now);
  const { jobs, shifts } = scopeToStore(session.storeId, { jobs: allJobs ?? [], shifts: allShifts ?? [] });
  const stores = (me?.stores ?? []).filter((store) => !session.storeId || store.id === session.storeId);
  return (
    <>
      <PageHeader
        action={
          <form action="/payroll" aria-label={m.payroll.month} className="exportForm" method="get">
            <label className="field compactField">
              <span className="visuallyHidden">{m.payroll.month}</span>
              <input defaultValue={month} name="month" type="month" />
            </label>
            <button className="button button-secondary" type="submit">{m.payroll.show}</button>
          </form>
        }
        description={m.payroll.description}
        eyebrow={m.payroll.eyebrow}
        obake="morattan"
        title={m.payroll.title}
      />
      {!me || !allShifts || !summaries || !allJobs || !applications || !closedPeriods ? (
        <ApiUnavailable m={m} />
      ) : me.member.role !== "manager" ? (
        <ManagerOnly m={m} />
      ) : (
        <PayrollView
          footer={
            <MonthClose
              canManage
              closedPeriods={closedPeriods}
              locale={locale}
              m={m}
              members={me.members}
              month={month}
              stores={stores}
            />
          }
          locale={locale}
          m={m}
          payroll={monthPayroll(month, shifts, summaries, jobs.length > 0 ? jobs : allJobs, applications, m.attendance.fallbackWorker)}
        />
      )}
    </>
  );
}
