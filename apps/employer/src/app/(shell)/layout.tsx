import type { ReactNode } from "react";
import { GlobalSearch, type SearchIndex } from "@/components/GlobalSearch";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { MobileTabBar } from "@/components/MobileTabBar";
import { SessionSwitchers } from "@/components/SessionSwitchers";
import { SidebarNav } from "@/components/SidebarNav";
import { getMe, listJobs, listWorkerHistories } from "@/lib/api";
import { getMessages } from "@/lib/i18n/server";
import { visibleGroups } from "@/lib/nav";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ShellLayout({ children }: Readonly<{ children: ReactNode }>) {
  const [{ locale, m }, session, me, jobs, histories] = await Promise.all([
    getMessages(),
    getSession(),
    getMe(),
    listJobs(),
    listWorkerHistories(),
  ]);
  const role = me?.member.role ?? "staff";
  const stores = me?.stores ?? [];
  const currentStore = stores.find((store) => store.id === session.storeId);
  const groups = visibleGroups(role);
  const index: SearchIndex = {
    workers: (histories ?? []).map((history) => ({ id: history.workerId, name: history.displayName })),
    jobs: (jobs ?? []).map((job) => ({ id: job.id, title: job.title, status: m.labels.jobStatus[job.status] })),
    pages: groups.flatMap((group) => group.items.map((item) => ({ href: item.href, label: m.nav[item.key] }))),
  };

  return (
    <div className="shell">
      <a className="skipLink" href="#main">{m.app.skipToContent}</a>
      <aside className="sidebar">
        <div aria-hidden="true" className="starfield" />
        <div className="brand">
          <img alt="" height={52} src="/obake/teamwork.webp" width={52} />
          <div><strong>Paw Time</strong><small>{m.app.brandSub}</small></div>
        </div>
        <GlobalSearch index={index} />
        <SidebarNav groups={groups} />
        <div className="sidebarFooter">
          <SessionSwitchers
            currentStoreId={session.storeId}
            member={me?.member ?? null}
            members={me?.members ?? []}
            stores={stores}
            theme={session.theme}
          />
          <LocaleSwitcher label={m.app.language} locale={locale} />
          <div className="organization">
            <small>{m.app.currentStore}</small>
            <strong>{me ? (currentStore?.name ?? m.app.allStores) : m.app.storeUnavailable}</strong>
          </div>
        </div>
      </aside>
      <main id="main">{children}</main>
      <MobileTabBar groups={groups} />
    </div>
  );
}
