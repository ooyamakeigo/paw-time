import { ApiUnavailable } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { WorkerRoster } from "@/features/workers/WorkerRoster";
import { listWorkerHistories } from "@/lib/api";
import { getMessages } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function WorkersPage() {
  const [{ locale, m }, histories] = await Promise.all([getMessages(), listWorkerHistories()]);
  return (
    <>
      <PageHeader description={m.workers.description} eyebrow={m.workers.eyebrow} obake="senpai" title={m.workers.title} />
      {histories ? <WorkerRoster histories={histories} locale={locale} m={m} /> : <ApiUnavailable m={m} />}
    </>
  );
}
