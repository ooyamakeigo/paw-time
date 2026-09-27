import { ApiUnavailable } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { WeekCalendar } from "@/features/calendar/WeekCalendar";
import { listApplications, listJobs, listShifts } from "@/lib/api";
import { isDateKey, todayKey, weekStartKey } from "@/lib/format";
import { getMessages } from "@/lib/i18n/server";
import { scopeToStore } from "@/lib/scope";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

type CalendarPageProps = { searchParams: Promise<{ week?: string }> };

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const [{ locale, m }, session, { week }, allShifts, allJobs, allApplications] = await Promise.all([
    getMessages(),
    getSession(),
    searchParams,
    listShifts(),
    listJobs(),
    listApplications(),
  ]);
  const today = todayKey();
  const weekStart = weekStartKey(isDateKey(week) ? week : today);
  const { jobs, shifts, applications } = scopeToStore(session.storeId, {
    jobs: allJobs ?? [],
    shifts: allShifts ?? [],
    applications: allApplications ?? [],
  });
  return (
    <>
      <PageHeader description={m.calendar.description} eyebrow={m.calendar.eyebrow} obake="asatsuyu" title={m.calendar.title} />
      {allShifts && allJobs && allApplications ? (
        <WeekCalendar
          applications={applications}
          jobs={jobs}
          locale={locale}
          m={m}
          shifts={shifts}
          today={today}
          weekStart={weekStart}
        />
      ) : (
        <ApiUnavailable m={m} />
      )}
    </>
  );
}
