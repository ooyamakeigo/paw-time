import Link from "next/link";
import { ApiUnavailable } from "@/components/EmptyState";
import { ManagerOnly } from "@/components/ManagerOnly";
import { PageHeader } from "@/components/PageHeader";
import { JobForm } from "@/features/job-postings/JobForm";
import { getMe, listJobs } from "@/lib/api";
import { createFormatters, shiftDateKey, todayKey } from "@/lib/format";
import { getMessages } from "@/lib/i18n/server";
import { rewardExperience } from "@/lib/island";

export const dynamic = "force-dynamic";

type NewJobPageProps = { searchParams: Promise<{ from?: string }> };

export default async function NewJobPage({ searchParams }: NewJobPageProps) {
  const [{ locale, m }, { from }, me, jobs] = await Promise.all([getMessages(), searchParams, getMe(), listJobs()]);
  const source = jobs?.find((job) => job.id === from);
  const { formatTime } = createFormatters(locale);
  return (
    <>
      <PageHeader
        action={<Link className="secondaryLink" href="/jobs">{m.jobForm.back}</Link>}
        description={m.jobForm.description}
        eyebrow={m.jobForm.eyebrow}
        obake="hajimete"
        title={m.jobForm.title}
      />
      {!me ? (
        <ApiUnavailable m={m} />
      ) : me.member.role !== "manager" ? (
        <ManagerOnly m={m} />
      ) : (
        <JobForm
          defaultDate={shiftDateKey(todayKey(), 1)}
          from={source ? { job: source, startTime: formatTime(source.startsAt), endTime: formatTime(source.endsAt) } : undefined}
          publishExperience={rewardExperience("job_published")}
          stores={me.stores}
        />
      )}
    </>
  );
}
