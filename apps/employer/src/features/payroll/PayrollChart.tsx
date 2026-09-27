import type { Formatters } from "@/lib/format";
import { fill, type Messages } from "@/lib/i18n/messages";
import { niceScale, type PayrollDay } from "@/lib/payroll";

type PayrollChartProps = {
  days: PayrollDay[];
  m: Messages;
  f: Formatters;
};

/**
 * Stacked columns per day: confirmed pay on the baseline, the projection on
 * top. One y axis with clean ticks, a legend for the two series, and a
 * per-column tooltip on hover and keyboard focus. Colors are the launch
 * page's orange and lavender, which pass the color-vision checks together.
 */
export function PayrollChart({ days, m, f }: PayrollChartProps) {
  const max = Math.max(0, ...days.map((day) => day.total));
  const { ceiling, ticks } = niceScale(max);
  const p = m.payroll;
  return (
    <figure className="payChart">
      <figcaption className="payLegend">
        <span><i className="swatch swatch-confirmed" />{p.legendConfirmed}</span>
        <span><i className="swatch swatch-projected" />{p.legendForecast}</span>
      </figcaption>
      <div className="payPlot">
        <div aria-hidden="true" className="payAxis">
          {[...ticks].reverse().map((tick) => <span key={tick}>{f.formatYen(tick)}</span>)}
        </div>
        <div className="payArea">
          <div aria-hidden="true" className="payGrid">
            {ticks.map((tick) => <span key={tick} />)}
          </div>
          <ol className="payColumns" role="list">
            {days.map((day) => {
              const label = fill(p.dayLabel, { day: day.day });
              const readout = `${label}: ${p.legendConfirmed} ${f.formatYen(day.confirmed)}, ${p.legendForecast} ${f.formatYen(day.projected)}, ${p.tooltipTotal} ${f.formatYen(day.total)}`;
              return (
                <li className={day.total > 0 ? "payColumn" : "payColumn payColumn-empty"} key={day.day}>
                  <button aria-label={readout} className="payHit" type="button">
                    <span className="payStack">
                      {day.projected > 0 ? (
                        <span className="paySegment paySegment-projected" style={{ height: `${(day.projected / ceiling) * 100}%` }} />
                      ) : null}
                      {day.confirmed > 0 ? (
                        <span className="paySegment paySegment-confirmed" style={{ height: `${(day.confirmed / ceiling) * 100}%` }} />
                      ) : null}
                    </span>
                    <span aria-hidden="true" className="payTooltip" role="tooltip">
                      <strong>{f.formatYen(day.total)}</strong>
                      <span>{label}</span>
                      <span><i className="swatch swatch-confirmed" />{f.formatYen(day.confirmed)} <small>{p.legendConfirmed}</small></span>
                      <span><i className="swatch swatch-projected" />{f.formatYen(day.projected)} <small>{p.legendForecast}</small></span>
                    </span>
                  </button>
                  <span aria-hidden="true" className="payDay">{day.day}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </figure>
  );
}
