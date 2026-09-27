import type { Store, StoreSettings } from "@paw-time/api-contracts";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { fill, type Messages } from "@/lib/i18n/messages";
import { updateSettingsAction } from "./actions";

const ROUNDING = [1, 5, 10, 15, 30];

/** One store's labor rules. Two break rules cover the legal ladder; a third row is spare. */
export function SettingsForm({ store, settings, m }: { store: Store; settings: StoreSettings; m: Messages }) {
  const rules = [...settings.breakRules, { workedOverMinutes: 0, requiredBreakMinutes: 0 }].slice(0, 3);
  return (
    <ActionForm action={updateSettingsAction} className="panel settingsForm">
      <input name="storeId" type="hidden" value={store.id} />
      <h2>{fill(m.settings.storeSection, { store: store.name })}</h2>
      <fieldset className="settingsFieldset">
        <legend>{m.settings.breakRules}</legend>
        <p className="hint">{m.settings.breakRuleHint}</p>
        {rules.map((rule, index) => (
          <div className="fieldPair" key={index}>
            <label className="field">
              <span>{m.settings.over}</span>
              <input defaultValue={rule.workedOverMinutes} min={0} name="breakOver" step={15} type="number" />
            </label>
            <label className="field">
              <span>{m.settings.required}</span>
              <input defaultValue={rule.requiredBreakMinutes} min={0} name="breakRequired" step={5} type="number" />
            </label>
          </div>
        ))}
      </fieldset>
      <div className="formGrid">
        <label className="field">
          <span>{m.settings.overtimeRate}</span>
          <div className="inputSuffix">
            <input defaultValue={Math.round(settings.overtimePremiumRate * 100)} max={100} min={0} name="overtimePremiumRate" type="number" />
            <span>%</span>
          </div>
        </label>
        <label className="field">
          <span>{m.settings.nightRate}</span>
          <div className="inputSuffix">
            <input defaultValue={Math.round(settings.nightPremiumRate * 100)} max={100} min={0} name="nightPremiumRate" type="number" />
            <span>%</span>
          </div>
        </label>
        <label className="field">
          <span>{m.settings.rounding}</span>
          <select defaultValue={settings.roundingMinutes} name="roundingMinutes">
            {ROUNDING.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes === 1 ? m.settings.roundingNone : fill(m.settings.roundingMinutes, { count: minutes })}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{m.settings.closingDay}</span>
          <select defaultValue={settings.closingDay} name="closingDay">
            <option value={0}>{m.settings.closingEnd}</option>
            {[5, 10, 15, 20, 25].map((day) => (
              <option key={day} value={day}>{fill(m.settings.closingDayN, { day })}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="formActions">
        <SubmitButton pendingLabel={m.common.saving}>{m.settings.save}</SubmitButton>
      </div>
    </ActionForm>
  );
}
