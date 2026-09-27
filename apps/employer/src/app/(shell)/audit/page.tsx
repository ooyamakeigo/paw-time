import { ApiUnavailable } from "@/components/EmptyState";
import { ManagerOnly } from "@/components/ManagerOnly";
import { PageHeader } from "@/components/PageHeader";
import { AuditTable } from "@/features/audit/AuditTable";
import { getMe, listAuditLogs } from "@/lib/api";
import { getMessages } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

type AuditPageProps = { searchParams: Promise<{ type?: string }> };

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const [{ locale, m }, { type }, me] = await Promise.all([getMessages(), searchParams, getMe()]);
  const entries = me?.member.role === "manager" ? await listAuditLogs() : null;
  return (
    <>
      <PageHeader description={m.audit.description} eyebrow={m.audit.eyebrow} obake="kazoeuta" title={m.audit.title} />
      {!me ? (
        <ApiUnavailable m={m} />
      ) : me.member.role !== "manager" ? (
        <ManagerOnly m={m} />
      ) : !entries ? (
        <ApiUnavailable m={m} />
      ) : (
        <AuditTable entries={entries} filter={type ?? null} locale={locale} m={m} members={me.members} />
      )}
    </>
  );
}
