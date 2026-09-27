import { ApiUnavailable } from "@/components/EmptyState";
import { ManagerOnly } from "@/components/ManagerOnly";
import { PageHeader } from "@/components/PageHeader";
import { InsightsView } from "@/features/insights/InsightsView";
import { getInsights, getMe, listShopFeedbackSummaries } from "@/lib/api";
import { getMessages } from "@/lib/i18n/server";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

type InsightsPageProps = { searchParams: Promise<{ days?: string }> };

export default async function InsightsPage({ searchParams }: InsightsPageProps) {
  const [{ locale, m }, session, { days: requested }, me] = await Promise.all([getMessages(), getSession(), searchParams, getMe()]);
  const days = [7, 30, 90].includes(Number(requested)) ? Number(requested) : 30;
  const manager = me?.member.role === "manager";
  const [report, feedback] = manager
    ? await Promise.all([getInsights(session.storeId, days), listShopFeedbackSummaries()])
    : [null, null];
  const stores = (me?.stores ?? []).filter((store) => !session.storeId || store.id === session.storeId);
  return (
    <>
      <PageHeader description={m.insights.description} eyebrow={m.insights.eyebrow} obake="mitsuboshi" title={m.insights.title} />
      {!me ? (
        <ApiUnavailable m={m} />
      ) : !manager ? (
        <ManagerOnly m={m} />
      ) : !report || !feedback ? (
        <ApiUnavailable m={m} />
      ) : (
        <InsightsView days={days} feedback={feedback} locale={locale} m={m} report={report} stores={stores} />
      )}
    </>
  );
}
