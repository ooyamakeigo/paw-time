import type { WorkerHistory } from "@paw-time/api-contracts";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { createFormatters } from "@/lib/format";
import { fill, type Locale, type Messages } from "@/lib/i18n/messages";
import { punctualityLabel } from "@/lib/labels";

type WorkerRosterProps = {
  histories: WorkerHistory[];
  m: Messages;
  locale: Locale;
};

/** The staff ledger: everyone who has been hired here, with what their shifts looked like. */
export function WorkerRoster({ histories, m, locale }: WorkerRosterProps) {
  const rows = histories
    .filter((history) => history.recentShifts.length > 0)
    .sort((left, right) => {
      const byMonth = right.monthWorkedMinutes - left.monthWorkedMinutes;
      if (byMonth !== 0) return byMonth;
      return Date.parse(right.lastWorkedAt ?? "1970-01-01") - Date.parse(left.lastWorkedAt ?? "1970-01-01");
    });
  if (rows.length === 0) {
    return <EmptyState description={m.workers.emptyDescription} obake="senpai" title={m.workers.emptyTitle} />;
  }
  const f = createFormatters(locale);
  const w = m.workers;
  return (
    <div className="tableCard">
      <table className="rosterTable">
        <thead>
          <tr>
            <th>{w.columns.worker}</th>
            <th>{w.columns.shifts}</th>
            <th>{w.columns.month}</th>
            <th>{w.columns.punctuality}</th>
            <th>{w.columns.rating}</th>
            <th>{w.columns.last}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((history) => {
            const judged = history.onTimeShifts + history.lateShifts;
            const rate = judged === 0 ? null : Math.round((history.onTimeShifts / judged) * 100);
            return (
              <tr id={`worker-${history.workerId}`} key={history.workerId}>
                <td>
                  <div className="rosterWho">
                    <Avatar name={history.displayName} seed={history.workerId} />
                    <div>
                      <strong>
                        {history.displayName}
                        {history.completedShifts >= 2 ? <span className="status status-regular">{w.regular}</span> : null}
                      </strong>
                      <details className="rosterDetails">
                        <summary>{w.recent}</summary>
                        <ul className="historyList" role="list">
                          {history.recentShifts.map((record) => {
                            const punctuality = punctualityLabel(
                              { punctuality: record.punctuality, minutesLate: record.minutesLate } as Parameters<typeof punctualityLabel>[0],
                              m,
                            );
                            return (
                              <li key={record.shiftId}>
                                <span className="historyDate">{f.formatDate(record.scheduledStartAt)}</span>
                                <span className="historyJob">{record.jobTitle}</span>
                                <span className={`status status-shift-${record.status}`}>{m.labels.shiftStatus[record.status]}</span>
                                {punctuality ? <span className={`status status-${record.punctuality}`}>{punctuality}</span> : null}
                                {record.workedMinutes > 0 ? <span className="historyMinutes">{f.formatMinutes(record.workedMinutes)}</span> : null}
                              </li>
                            );
                          })}
                        </ul>
                      </details>
                    </div>
                  </div>
                </td>
                <td>
                  <strong>{fill(w.shiftsCell, { count: history.completedShifts })}</strong>
                  {history.noShows > 0 ? <span className="cellWarn">{fill(w.noShowCell, { count: history.noShows })}</span> : null}
                </td>
                <td>{history.monthWorkedMinutes > 0 ? f.formatMinutes(history.monthWorkedMinutes) : m.common.none}</td>
                <td>
                  {rate === null ? m.common.none : <strong>{fill(w.onTimeRate, { rate })}</strong>}
                  {history.lateShifts > 0 ? <span className="cellWarn">{fill(w.lateCell, { count: history.lateShifts })}</span> : null}
                </td>
                <td>
                  {history.averageRating === null ? (
                    m.common.none
                  ) : (
                    <>
                      <strong className="ratingCell">
                        <i aria-hidden="true">★</i>
                        {history.averageRating.toFixed(1)}
                      </strong>
                      <span>{fill(w.ratingCount, { count: history.evaluationCount })}</span>
                    </>
                  )}
                </td>
                <td>{history.lastWorkedAt ? f.formatDate(history.lastWorkedAt) : m.common.none}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
