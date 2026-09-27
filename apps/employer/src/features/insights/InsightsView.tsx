import { SHOP_REVIEW_TAGS, type InsightsReport, type ShopFeedbackSummary, type Store } from "@paw-time/api-contracts";
import Link from "next/link";
import { createFormatters } from "@/lib/format";
import { fill, type Locale, type Messages } from "@/lib/i18n/messages";

type InsightsViewProps = {
  report: InsightsReport;
  feedback: ShopFeedbackSummary[];
  stores: Store[];
  days: number;
  m: Messages;
  locale: Locale;
};

const KPI_KEYS = [
  "nextDayOpenRate",
  "returnRate",
  "reapplyRate",
  "fillRate",
  "inTimeDecisionRate",
  "lastMinuteCancelRate",
  "noShowRate",
] as const;

/** Lower is better for the last two. */
const INVERTED = new Set(["lastMinuteCancelRate", "noShowRate"]);

export function InsightsView({ report, feedback, stores, days, m, locale }: InsightsViewProps) {
  const f = createFormatters(locale);
  const t = m.insights;
  const shown = feedback.filter((summary) => stores.some((store) => store.id === summary.storeId));
  return (
    <div className="groupList">
      <nav aria-label={t.period} className="filters">
        {[7, 30, 90].map((option) => (
          <Link aria-current={option === days ? "page" : undefined} href={`/insights?days=${option}`} key={option}>
            {fill(t.days, { count: option })}
          </Link>
        ))}
        <Link className="filtersAction" href="/insights/print">{t.print}</Link>
      </nav>
      <section className="kpiGrid">
        {KPI_KEYS.map((key) => {
          const value = report[key];
          const tone = value === null ? "" : INVERTED.has(key) ? (value <= 0.1 ? " kpi-good" : " kpi-warn") : value >= 0.6 ? " kpi-good" : "";
          return (
            <article className={`kpi${tone}`} key={key}>
              <span>{t.kpis[key]}</span>
              <strong>{value === null ? t.notEnough : f.formatPercent(value)}</strong>
              <small>{t.kpiHints[key]}</small>
            </article>
          );
        })}
        <article className="kpi kpi-plain">
          <span>{t.completedShifts}</span>
          <strong>{report.completedShifts}</strong>
          <small>{fill(t.distinctWorkers, {})}: {report.distinctWorkers} ・ {t.islandVisits}: {report.islandVisits}</small>
        </article>
      </section>

      <section className="panel">
        <p className="eyebrow">{t.feedbackTitle}</p>
        <h2>{t.feedbackTitle}</h2>
        <p className="hint">{t.feedbackHint}</p>
        <div className="feedbackGrid">
          {shown.map((summary) => {
            const store = stores.find((candidate) => candidate.id === summary.storeId);
            return (
              <article className="feedbackCard" key={summary.storeId}>
                <h3>{store?.name ?? summary.storeId}</h3>
                {summary.published ? (
                  <>
                    <p className="feedbackBasedOn">
                      {fill(t.feedbackBasedOn, { count: summary.responses, stars: (summary.averageStars ?? 0).toFixed(1) })}
                    </p>
                    <ul role="list">
                      {SHOP_REVIEW_TAGS.map((tag) => (
                        <li key={tag}>
                          <span>{m.shopIsland.tags[tag]}</span>
                          <div className="meter"><span style={{ width: `${Math.min(100, ((summary.tags[tag] ?? 0) / Math.max(1, summary.responses)) * 100)}%` }} /></div>
                          <strong>{fill(t.feedbackVotes, { votes: summary.tags[tag] ?? 0 })}</strong>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="hint">{fill(t.feedbackHidden, { count: summary.responses })}</p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">{t.jobsTitle}</p>
        <h2>{t.jobsTitle}</h2>
        <div className="tableCard tableCard-flat">
          <table className="compactTable">
            <thead>
              <tr>
                <th>{t.jobColumns.job}</th>
                <th>{t.jobColumns.when}</th>
                <th className="numeric">{t.jobColumns.applications}</th>
                <th className="numeric">{t.jobColumns.filled}</th>
                <th className="numeric">{t.jobColumns.hoursToFill}</th>
                <th className="numeric">{t.jobColumns.inTime}</th>
              </tr>
            </thead>
            <tbody>
              {report.jobs.map((job) => (
                <tr key={job.jobId}>
                  <td><strong>{job.title}</strong></td>
                  <td>{f.formatDate(job.startsAt)}</td>
                  <td className="numeric">{job.applications}</td>
                  <td className="numeric">{job.selected} / {job.capacity}</td>
                  <td className="numeric">{job.hoursToFill === null ? t.notFilled : fill(t.hoursToFill, { hours: job.hoursToFill })}</td>
                  <td className="numeric">{f.formatPercent(job.inTimeDecisionRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
