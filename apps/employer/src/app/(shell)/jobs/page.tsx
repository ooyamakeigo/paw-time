import Link from "next/link";
import { ApiUnavailable } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { JobList } from "@/features/job-postings/JobList";
import { getMe, listApplications, listJobs } from "@/lib/api";
import { fill } from "@/lib/i18n/messages";
import { getMessages } from "@/lib/i18n/server";
import { rewardExperience } from "@/lib/island";
import { scopeToStore } from "@/lib/scope";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

type JobsPageProps = { searchParams: Promise<{ created?: string; count?: string }> };

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const [{ locale, m }, session, { created, count }, me, allJobs, allApplications] = await Promise.all([
    getMessages(),
    getSession(),
    searchParams,
    getMe(),
    listJobs(),
    listApplications(),
  ]);
  const canManage = me?.member.role === "manager";
  const { jobs, applications } = scopeToStore(session.storeId, { jobs: allJobs ?? [], applications: allApplications ?? [] });
  const createdJob = allJobs?.find((job) => job.id === created);
  const createdCount = Number(count ?? "1");
  return (
    <>
      <PageHeader
        action={canManage ? <Link className="primaryButton" href="/jobs/new">{m.jobs.newJob}</Link> : undefined}
        description={m.jobs.description}
        eyebrow={m.jobs.eyebrow}
        obake="kirari"
        title={m.jobs.title}
      />
      {createdJob ? (
        <p className="notice" role="status">
          {createdCount > 1
            ? fill(m.jobs.noticeRepeated, { count: createdCount })
            : fill(createdJob.status === "published" ? m.jobs.noticePublished : m.jobs.noticeDraft, { title: createdJob.title })}
        </p>
      ) : null}
      {allJobs && allApplications && me ? (
        <JobList
          applications={applications}
          canManage={canManage}
          highlightId={created}
          jobs={jobs}
          locale={locale}
          m={m}
          publishExperience={rewardExperience("job_published")}
          stores={me.stores}
        />
      ) : (
        <ApiUnavailable m={m} />
      )}
    </>
  );
}
