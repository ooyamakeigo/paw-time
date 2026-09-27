import { ApiUnavailable } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { ApplicationList } from "@/features/applicants/ApplicationList";
import { getMe, listApplications, listInvitations, listJobs, listWorkerHistories } from "@/lib/api";
import { getMessages } from "@/lib/i18n/server";
import { rewardExperience } from "@/lib/island";
import { scopeToStore } from "@/lib/scope";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const [{ locale, m }, session, me, allApplications, allJobs, histories, invitations] = await Promise.all([
    getMessages(),
    getSession(),
    getMe(),
    listApplications(),
    listJobs(),
    listWorkerHistories(),
    listInvitations(),
  ]);
  const { jobs, applications } = scopeToStore(session.storeId, { jobs: allJobs ?? [], applications: allApplications ?? [] });
  return (
    <>
      <PageHeader
        description={m.applications.description}
        eyebrow={m.applications.eyebrow}
        obake="hatsukoe"
        title={m.applications.title}
      />
      {allApplications && allJobs && histories && invitations && me ? (
        <ApplicationList
          applications={applications}
          canManage={me.member.role === "manager"}
          histories={histories}
          inTimeExperience={rewardExperience("application_decided_in_time")}
          invitations={invitations}
          jobs={jobs}
          locale={locale}
          m={m}
          now={new Date()}
        />
      ) : (
        <ApiUnavailable m={m} />
      )}
    </>
  );
}
