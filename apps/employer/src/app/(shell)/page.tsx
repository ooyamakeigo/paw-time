import Link from "next/link";
import { ApiUnavailable } from "@/components/EmptyState";
import { Dashboard } from "@/features/dashboard/Dashboard";
import {
  getEmployerWorld,
  getMe,
  listApplications,
  listAttendanceSummaries,
  listEvaluations,
  listJobs,
  listLetters,
  listShifts,
} from "@/lib/api";
import { createFormatters } from "@/lib/format";
import { fill } from "@/lib/i18n/messages";
import { getMessages } from "@/lib/i18n/server";
import { scopeToStore } from "@/lib/scope";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const now = new Date();
  const [{ locale, m }, session, me, allJobs, allApplications, allShifts, summaries, evaluations, letters, world] = await Promise.all([
    getMessages(),
    getSession(),
    getMe(),
    listJobs(),
    listApplications(),
    listShifts(),
    listAttendanceSummaries(),
    listEvaluations(),
    listLetters(),
    getEmployerWorld(),
  ]);
  const { jobs, applications, shifts } = scopeToStore(session.storeId, {
    jobs: allJobs ?? [],
    applications: allApplications ?? [],
    shifts: allShifts ?? [],
  });
  const { formatDate } = createFormatters(locale);
  return (
    <>
      <header className="hero">
        <div aria-hidden="true" className="starfield" />
        <div className="heroText">
          <p className="eyebrow eyebrow-gold">{fill(m.home.eyebrow, { date: formatDate(now) })}</p>
          <h1>{m.home.title}</h1>
          <p className="heroTag">
            {m.home.tagBefore}<span>{m.home.tagHighlight}</span>{m.home.tagAfter}
          </p>
          <div className="cta">
            <Link className="primaryButton" href="/jobs/new">{m.home.createJob}</Link>
            <Link className="ghostButton" href="/attendance">{m.home.todayAttendance}</Link>
          </div>
        </div>
        <img alt="" className="float f1" height={132} src="/obake/amagasa.webp" width={132} />
        <img alt="" className="float f2" height={120} src="/obake/kazaguruma.webp" width={120} />
      </header>
      {allJobs && allApplications && allShifts && summaries && world && me ? (
        <Dashboard
          applications={applications}
          canManage={me.member.role === "manager"}
          evaluations={evaluations}
          jobs={jobs}
          letters={letters}
          locale={locale}
          m={m}
          now={now}
          onboardingDismissed={session.onboardingDismissed}
          shifts={shifts}
          summaries={summaries}
          world={world}
        />
      ) : (
        <ApiUnavailable m={m} />
      )}
    </>
  );
}
