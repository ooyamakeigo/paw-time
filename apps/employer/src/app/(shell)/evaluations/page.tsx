import { ApiUnavailable } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { ReviewBoard } from "@/features/evaluations/ReviewBoard";
import {
  listApplications,
  listAttendanceSummaries,
  listEvaluations,
  listJobs,
  listLetters,
  listShifts,
} from "@/lib/api";
import { getMessages } from "@/lib/i18n/server";
import { rewardExperience } from "@/lib/island";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const [{ locale, m }, shifts, evaluations, letters, applications, jobs, summaries] = await Promise.all([
    getMessages(),
    listShifts(),
    listEvaluations(),
    listLetters(),
    listApplications(),
    listJobs(),
    listAttendanceSummaries(),
  ]);
  return (
    <>
      <PageHeader description={m.reviews.description} eyebrow={m.reviews.eyebrow} obake="okurimono" title={m.reviews.title} />
      {shifts && evaluations && letters && applications && jobs && summaries ? (
        <ReviewBoard
          applications={applications}
          evaluationExperience={rewardExperience("evaluation_submitted")}
          evaluations={evaluations}
          jobs={jobs}
          letterExperience={rewardExperience("letter_sent")}
          letters={letters}
          locale={locale}
          m={m}
          shifts={shifts}
          summaries={summaries}
        />
      ) : (
        <ApiUnavailable m={m} />
      )}
    </>
  );
}
