import { ApiUnavailable } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { IslandDetails } from "@/features/employer-island/IslandDetails";
import { ShopIsland } from "@/features/employer-island/ShopIsland";
import {
  getEmployerWorld,
  getMe,
  listApplications,
  listLetters,
  listRewards,
  listShopFeedbackSummaries,
  listWorkerHistories,
} from "@/lib/api";
import { getMessages } from "@/lib/i18n/server";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function IslandPage() {
  const now = new Date();
  const [{ locale, m }, session, me, world, rewards, feedback, histories, letters, applications] = await Promise.all([
    getMessages(),
    getSession(),
    getMe(),
    getEmployerWorld(),
    listRewards(),
    listShopFeedbackSummaries(),
    listWorkerHistories(),
    listLetters(),
    listApplications(),
  ]);
  const store = me?.stores.find((candidate) => candidate.id === session.storeId) ?? me?.stores[0];
  const summary = feedback?.find((candidate) => candidate.storeId === store?.id);
  const regulars = (histories ?? [])
    .filter((history) => history.completedShifts >= 2)
    .sort((left, right) => right.completedShifts - left.completedShifts);
  return (
    <>
      <PageHeader description={m.island.description} eyebrow={m.island.eyebrow} title={m.island.title} />
      {world && rewards && feedback && store && summary ? (
        <>
          <ShopIsland regulars={regulars} sample={store.id === "store-komorebi"} store={store} summary={summary} world={world} />
          <IslandDetails
            applications={applications ?? []}
            letters={letters ?? []}
            locale={locale}
            m={m}
            now={now}
            regulars={regulars}
            rewards={rewards}
            world={world}
          />
        </>
      ) : (
        <ApiUnavailable m={m} />
      )}
    </>
  );
}
