import type { ClosedPeriod, Member, Store } from "@paw-time/api-contracts";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { createFormatters } from "@/lib/format";
import { fill, type Locale, type Messages } from "@/lib/i18n/messages";
import { closePeriodAction, reopenPeriodAction } from "./actions";

type MonthCloseProps = {
  month: string;
  stores: Store[];
  members: Member[];
  closedPeriods: ClosedPeriod[];
  canManage: boolean;
  m: Messages;
  locale: Locale;
};

/** Locks or unlocks the month per store, once payroll has the numbers. */
export function MonthClose({ month, stores, members, closedPeriods, canManage, m, locale }: MonthCloseProps) {
  const f = createFormatters(locale);
  const label = f.formatMonth(month);
  return (
    <section className="panel">
      <p className="eyebrow">{m.payroll.closeEyebrow}</p>
      <h2>{fill(m.payroll.closeTitle, { month: label })}</h2>
      <p className="hint">{m.payroll.closeHint}</p>
      <ul className="closeList" role="list">
        {stores.map((store) => {
          const period = closedPeriods.find((candidate) => candidate.storeId === store.id && candidate.month === month);
          const who = members.find((member) => member.id === period?.closedBy)?.displayName ?? period?.closedBy ?? "";
          return (
            <li key={store.id}>
              <div>
                <strong>{store.name}</strong>
                {period ? (
                  <small>{fill(m.payroll.closedAt, { who, date: f.formatDateTime(period.closedAt) })}</small>
                ) : null}
              </div>
              {period ? (
                <span className="status status-closed">🔒 {fill(m.payroll.closedTitle, { month: label })}</span>
              ) : null}
              {canManage ? (
                period ? (
                  <ActionForm action={reopenPeriodAction} className="inlineAction">
                    <input name="periodId" type="hidden" value={period.id} />
                    <SubmitButton pendingLabel={m.common.saving} variant="ghost">{m.payroll.reopenButton}</SubmitButton>
                  </ActionForm>
                ) : (
                  <ActionForm action={closePeriodAction} className="inlineAction">
                    <input name="storeId" type="hidden" value={store.id} />
                    <input name="month" type="hidden" value={month} />
                    <SubmitButton pendingLabel={m.common.saving} variant="secondary">{m.payroll.closeButton}</SubmitButton>
                  </ActionForm>
                )
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
