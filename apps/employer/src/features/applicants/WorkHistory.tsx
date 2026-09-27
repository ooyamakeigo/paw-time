import type { WorkerHistory } from "@paw-time/api-contracts";
import { fill, type Messages } from "@/lib/i18n/messages";
import type { Formatters } from "@/lib/format";
import { punctualityLabel } from "@/lib/labels";

type WorkHistoryProps = {
  history: WorkerHistory | undefined;
  m: Messages;
  f: Formatters;
};

/** What this shop already knows about an applicant: shifts, punctuality, ratings. */
export function WorkHistory({ history, m, f }: WorkHistoryProps) {
  const seen = history && (history.completedShifts > 0 || history.noShows > 0 || history.recentShifts.length > 0);
  if (!history || !seen) {
    return (
      <p className="historyLine">
        <span className="status status-first">{m.applications.history.first}</span>
      </p>
    );
  }
  const h = m.applications.history;
  return (
    <div className="history">
      <ul className="historyChips" role="list">
        <li className="chip chip-strong">{fill(h.shifts, { count: history.completedShifts })}</li>
        {history.onTimeShifts > 0 ? <li className="chip chip-good">{fill(h.onTime, { count: history.onTimeShifts })}</li> : null}
        {history.lateShifts > 0 ? <li className="chip chip-warn">{fill(h.late, { count: history.lateShifts })}</li> : null}
        {history.noShows > 0 ? <li className="chip chip-bad">{fill(h.noShow, { count: history.noShows })}</li> : null}
        <li className="chip">
          {history.averageRating === null ? h.noRating : fill(h.rating, { rating: history.averageRating.toFixed(1) })}
        </li>
        {history.lastWorkedAt ? <li className="chip chip-quiet">{fill(h.lastWorked, { date: f.formatDate(history.lastWorkedAt) })}</li> : null}
      </ul>
      {history.recentShifts.length > 0 ? (
        <details className="historyDetails">
          <summary>{fill(h.details, { count: history.recentShifts.length })}</summary>
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
                  {record.rating !== null ? (
                    <span aria-label={fill(m.reviews.stars, { count: record.rating })} className="stars starsSmall">
                      {"★".repeat(record.rating)}<span className="starsOff">{"★".repeat(5 - record.rating)}</span>
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
