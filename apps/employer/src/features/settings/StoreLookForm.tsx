import type { Store } from "@paw-time/api-contracts";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import type { Messages } from "@/lib/i18n/messages";
import { updateStoreLookAction } from "./actions";

/** What a shop may decide about its island: the logo on the signboard, two colors and one line. */
export function StoreLookForm({ store, m }: { store: Store; m: Messages }) {
  const t = m.shopIsland.look;
  return (
    <ActionForm action={updateStoreLookAction} className="panel settingsForm lookForm">
      <input name="storeId" type="hidden" value={store.id} />
      <p className="eyebrow">{t.eyebrow}</p>
      <h2>{t.title} ・ {store.name}</h2>
      <p className="hint">{t.description}</p>
      <div className="lookGrid">
        <div className="lookPreview" style={{ background: store.signColor }}>
          <div className="lookBoard" style={{ background: store.accentColor }}>
            {store.logoUrl ? (
              <img alt={store.name} height={48} src={store.logoUrl} width={128} />
            ) : (
              <strong style={{ color: store.signColor }}>{store.name}</strong>
            )}
          </div>
          <div className="lookAwning" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => (
              <span key={index} style={{ background: index % 2 === 0 ? store.signColor : store.accentColor }} />
            ))}
          </div>
        </div>
        <div className="formGrid lookFields">
          <label className="field fieldWide">
            <span>{t.logo}</span>
            <input accept="image/png,image/svg+xml,image/jpeg,image/webp" name="logo" type="file" />
            <small className="hint">{t.logoHint}</small>
          </label>
          {store.logoUrl ? (
            <label className="field checkField fieldWide">
              <input name="removeLogo" type="checkbox" />
              <span>{t.logoRemove}</span>
            </label>
          ) : null}
          <label className="field">
            <span>{t.signColor}</span>
            <input defaultValue={store.signColor} name="signColor" type="color" />
          </label>
          <label className="field">
            <span>{t.accentColor}</span>
            <input defaultValue={store.accentColor} name="accentColor" type="color" />
          </label>
          <label className="field fieldWide">
            <span>{t.values}</span>
            <input defaultValue={store.values} maxLength={80} name="values" placeholder={t.valuesPlaceholder} type="text" />
          </label>
        </div>
      </div>
      <div className="formActions">
        <SubmitButton pendingLabel={m.common.saving}>{t.save}</SubmitButton>
      </div>
    </ActionForm>
  );
}
