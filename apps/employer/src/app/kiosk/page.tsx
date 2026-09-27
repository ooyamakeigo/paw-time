import Link from "next/link";
import { ApiUnavailable } from "@/components/EmptyState";
import { KioskBoard } from "@/features/kiosk/KioskBoard";
import { getMe, listApplications, listAttendanceSummaries, listJobs, listShifts } from "@/lib/api";
import { dateKey, todayKey } from "@/lib/format";
import { getMessages } from "@/lib/i18n/server";
import { scopeToStore } from "@/lib/scope";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Full-screen, no sidebar: the tablet by the door. */
export default async function KioskPage() {
  const [{ m }, session, me, allShifts, summaries, applications, allJobs] = await Promise.all([
    getMessages(),
    getSession(),
    getMe(),
    listShifts(),
    listAttendanceSummaries(),
    listApplications(),
    listJobs(),
  ]);
  const today = todayKey();
  const { jobs, shifts } = scopeToStore(session.storeId, { jobs: allJobs ?? [], shifts: allShifts ?? [] });
  const todayShifts = shifts
    .filter((shift) => dateKey(shift.scheduledStartAt) === today && shift.status !== "cancelled" && shift.status !== "no_show")
    .sort((left, right) => Date.parse(left.scheduledStartAt) - Date.parse(right.scheduledStartAt));
  const store = me?.stores.find((candidate) => candidate.id === session.storeId) ?? me?.stores[0];
  return (
    <div className="kioskShell">
      <div aria-hidden="true" className="starfield" />
      <div className="kioskTop">
        <span className="kioskStore">{store?.name ?? ""}</span>
        <Link className="ghostButton" href="/attendance">{m.kiosk.exit}</Link>
      </div>
      {allShifts && summaries && applications && allJobs ? (
        <KioskBoard
          applications={applications}
          initialNow={new Date().toISOString()}
          jobs={jobs.length > 0 ? jobs : allJobs}
          shifts={todayShifts}
          summaries={summaries}
        />
      ) : (
        <ApiUnavailable m={m} />
      )}
    </div>
  );
}
