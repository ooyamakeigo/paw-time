import type { ReactNode } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { createFormatters, shiftMonthKey } from "@/lib/format";
import { fill, type Locale, type Messages } from "@/lib/i18n/messages";
import type { MonthPayroll } from "@/lib/payroll";
import { PayrollChart } from "./PayrollChart";

type PayrollViewProps = {
  payroll: MonthPayroll;
  m: Messages;
  locale: Locale;
  /** The month-close panel, rendered under the charts. */
  footer?: ReactNode;
};

export function PayrollView({ payroll, m, locale, footer }: PayrollViewProps) {
  const f = createFormatters(locale);
  const p = m.payroll;
  const tiles = [
    { key: "confirmed", label: p.confirmed, amount: payroll.totals.confirmed, count: payroll.counts.confirmed, tone: "confirmed" },
    { key: "awaiting", label: p.awaiting, amount: payroll.totals.awaiting, count: payroll.counts.awaiting, tone: "projected" },
    { key: "forecast", label: p.forecast, amount: payroll.totals.forecast, count: payroll.counts.forecast, tone: "projected" },
  ] as const;
  const maxWorker = Math.max(0, ...payroll.workers.map((worker) => worker.total));

  return (
    <div className="groupList">
      <section className="payHero panel nightPanel">
        <div aria-hidden="true" className="starfield" />
        <div className="payHeroMain">
          <p className="eyebrow eyebrow-gold">{p.total} ・ {f.formatMonth(payroll.month)}</p>
          <p className="heroFigure">{f.formatYen(payroll.totals.all)}</p>
          <p>{fill(p.shifts, { count: payroll.lines.length })}</p>
        </div>
        <ul className="payTiles" role="list">
          {tiles.map((tile) => (
            <li className={`payTile payTile-${tile.tone}`} key={tile.key}>
              <span>{tile.label}</span>
              <strong>{f.formatYen(tile.amount)}</strong>
              <small>{fill(p.shifts, { count: tile.count })}</small>
            </li>
          ))}
        </ul>
      </section>

      {payroll.lines.length === 0 ? (
        <EmptyState description={p.emptyDescription} obake="morattan" title={p.emptyTitle} />
      ) : (
        <>
          <section className="panel">
            <p className="eyebrow">{p.byDay}</p>
            <h2>{f.formatMonth(payroll.month)}</h2>
            <p className="hint">{p.byDayHint}</p>
            <PayrollChart days={payroll.days} f={f} m={m} />
            <details className="tableDetails">
              <summary>{p.table}</summary>
              <table className="compactTable">
                <thead>
                  <tr>
                    <th>{p.columns.day}</th>
                    <th className="numeric">{p.columns.confirmed}</th>
                    <th className="numeric">{p.columns.forecast}</th>
                    <th className="numeric">{p.columns.total}</th>
                  </tr>
                </thead>
                <tbody>
                  {payroll.days
                    .filter((day) => day.total > 0)
                    .map((day) => (
                      <tr key={day.day}>
                        <td>{fill(p.dayLabel, { day: day.day })}</td>
                        <td className="numeric">{f.formatYen(day.confirmed)}</td>
                        <td className="numeric">{f.formatYen(day.projected)}</td>
                        <td className="numeric"><strong>{f.formatYen(day.total)}</strong></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </details>
          </section>

          <section className="panel">
            <p className="eyebrow">{p.byWorker}</p>
            <h2>{p.workerColumns.pay}</h2>
            <ol className="workerBars" role="list">
              {payroll.workers.map((worker) => (
                <li key={worker.workerId}>
                  <div className="workerBarWho">
                    <Avatar name={worker.name} seed={worker.workerId} />
                    <div>
                      <strong>{worker.name}</strong>
                      <small>
                        {fill(p.shifts, { count: worker.shifts })}
                        {worker.workedMinutes > 0 ? ` ・ ${f.formatMinutes(worker.workedMinutes)}` : ""}
                      </small>
                    </div>
                  </div>
                  <div aria-hidden="true" className="workerBarTrack">
                    {worker.confirmed > 0 ? (
                      <span className="paySegment paySegment-confirmed" style={{ width: `${(worker.confirmed / maxWorker) * 100}%` }} />
                    ) : null}
                    {worker.projected > 0 ? (
                      <span className="paySegment paySegment-projected" style={{ width: `${(worker.projected / maxWorker) * 100}%` }} />
                    ) : null}
                  </div>
                  <strong className="workerBarValue">{f.formatYen(worker.total)}</strong>
                </li>
              ))}
            </ol>
            <p className="hint">{p.forecastNote}</p>
            <Link className="inlineLink" href={`/attendance/export?month=${payroll.month}`}>{p.csv} ↓</Link>
          </section>
        </>
      )}
      {footer}
      <nav aria-label={p.month} className="monthNav">
        <Link className="button button-secondary" href={`/payroll?month=${shiftMonthKey(payroll.month, -1)}`}>
          ← {f.formatMonth(shiftMonthKey(payroll.month, -1))}
        </Link>
        <Link className="button button-secondary" href={`/payroll?month=${shiftMonthKey(payroll.month, 1)}`}>
          {f.formatMonth(shiftMonthKey(payroll.month, 1))} →
        </Link>
      </nav>
    </div>
  );
}
