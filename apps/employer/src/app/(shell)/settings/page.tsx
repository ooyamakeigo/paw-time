import { ApiUnavailable } from "@/components/EmptyState";
import { Avatar } from "@/components/Avatar";
import { ManagerOnly } from "@/components/ManagerOnly";
import { PageHeader } from "@/components/PageHeader";
import { SettingsForm } from "@/features/settings/SettingsForm";
import { StoreLookForm } from "@/features/settings/StoreLookForm";
import { getMe, listStoreSettings } from "@/lib/api";
import { getMessages } from "@/lib/i18n/server";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [{ m }, session, me, settings] = await Promise.all([getMessages(), getSession(), getMe(), listStoreSettings()]);
  const stores = (me?.stores ?? []).filter((store) => !session.storeId || store.id === session.storeId);
  return (
    <>
      <PageHeader description={m.settings.description} eyebrow={m.settings.eyebrow} obake="totonou" title={m.settings.title} />
      {!me || !settings ? (
        <ApiUnavailable m={m} />
      ) : me.member.role !== "manager" ? (
        <ManagerOnly m={m} />
      ) : (
        <div className="groupList">
          {stores.map((store) => (
            <StoreLookForm key={`look-${store.id}`} m={m} store={store} />
          ))}
          {stores.map((store) => {
            const own = settings.find((candidate) => candidate.storeId === store.id);
            return own ? <SettingsForm key={store.id} m={m} settings={own} store={store} /> : null;
          })}
          <section className="panel">
            <p className="eyebrow">{m.settings.eyebrow}</p>
            <h2>{m.settings.membersTitle}</h2>
            <p className="hint">{m.settings.membersHint}</p>
            <ul className="memberList" role="list">
              {me.members.map((member) => (
                <li key={member.id}>
                  <Avatar name={member.displayName} seed={member.id} />
                  <strong>{member.displayName}</strong>
                  <span className={`status status-role-${member.role}`}>{m.labels.memberRole[member.role]}</span>
                  {member.id === me.member.id ? <small>{m.settings.you}</small> : null}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </>
  );
}
