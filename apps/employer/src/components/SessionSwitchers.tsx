"use client";

import type { Member, Store } from "@paw-time/api-contracts";
import { setActorAction, setStoreAction, setThemeAction } from "@/features/session/actions";
import { useMessages } from "@/lib/i18n/client";
import type { Theme } from "@/lib/session";

type SessionSwitchersProps = {
  member: Member | null;
  members: Member[];
  stores: Store[];
  currentStoreId: string | null;
  theme: Theme;
};

/** Who is acting, which store the screens show, and day or night colors. */
export function SessionSwitchers({ member, members, stores, currentStoreId, theme }: SessionSwitchersProps) {
  const m = useMessages();
  const submit = (form: HTMLFormElement | null) => form?.requestSubmit();
  return (
    <div className="sessionSwitchers">
      {members.length > 0 ? (
        <form action={setActorAction} className="switcher">
          <label>
            <span>{m.app.actor}</span>
            <select defaultValue={member?.id ?? ""} name="actorId" onChange={(event) => submit(event.currentTarget.form)}>
              {members.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.displayName} ・ {m.labels.memberRole[candidate.role]}
                </option>
              ))}
            </select>
          </label>
        </form>
      ) : null}
      {stores.length > 1 ? (
        <form action={setStoreAction} className="switcher">
          <label>
            <span>{m.app.currentStore}</span>
            <select defaultValue={currentStoreId ?? "all"} name="storeId" onChange={(event) => submit(event.currentTarget.form)}>
              <option value="all">{m.app.allStores}</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
          </label>
        </form>
      ) : null}
      <form action={setThemeAction} aria-label={m.app.theme} className="themeSwitcher">
        {(["auto", "light", "dark"] as const).map((option) => (
          <button aria-pressed={theme === option} key={option} name="theme" type="submit" value={option}>
            {option === "auto" ? m.app.themeAuto : option === "light" ? m.app.themeLight : m.app.themeDark}
          </button>
        ))}
      </form>
    </div>
  );
}
