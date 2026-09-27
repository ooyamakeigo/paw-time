import type { Application, JobPosting, Shift } from "@paw-time/api-contracts";
import Link from "next/link";
import { createFormatters, dateKey, shiftDateKey } from "@/lib/format";
import { fill, type Locale, type Messages } from "@/lib/i18n/messages";

type WeekCalendarProps = {
  weekStart: string;
  today: string;
  shifts: Shift[];
  jobs: JobPosting[];
  applications: Application[];
  m: Messages;
  locale: Locale;
};

/** Seven columns: who is in, and which published jobs still have openings that day. */
export function WeekCalendar({ weekStart, today, shifts, jobs, applications, m, locale }: WeekCalendarProps) {
  const f = createFormatters(locale);
  const days = Array.from({ length: 7 }, (_, index) => shiftDateKey(weekStart, index));
  const workerName = (shift: Shift) =>
    applications.find((application) => application.id === shift.applicationId)?.workerDisplayName ?? m.attendance.fallbackWorker;
  const selectedCount = (jobId: string) =>
    applications.filter((application) => application.jobPostingId === jobId && application.status === "selected").length;

  return (
    <div className="calendar">
      <nav aria-label={m.calendar.title} className="calendarNav">
        <Link className="button button-secondary" href={`/calendar?week=${shiftDateKey(weekStart, -7)}`}>{m.calendar.prev}</Link>
        <div className="calendarRange">
          <strong>{fill(m.calendar.weekOf, { start: f.formatShortDate(`${weekStart}T12:00:00+09:00`), end: f.formatShortDate(`${days[6]}T12:00:00+09:00`) })}</strong>
          <Link className="inlineLink" href="/calendar">{m.calendar.thisWeek}</Link>
        </div>
        <Link className="button button-secondary" href={`/calendar?week=${shiftDateKey(weekStart, 7)}`}>{m.calendar.next}</Link>
      </nav>
      <ol className="calendarGrid" role="list">
        {days.map((day) => {
          const dayShifts = shifts
            .filter((shift) => dateKey(shift.scheduledStartAt) === day && shift.status !== "cancelled")
            .sort((left, right) => Date.parse(left.scheduledStartAt) - Date.parse(right.scheduledStartAt));
          const openJobs = jobs
            .filter((job) => job.status === "published" && dateKey(job.startsAt) === day && selectedCount(job.id) < job.capacity)
            .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt));
          return (
            <li className={`calendarDay${day === today ? " calendarDay-today" : ""}`} key={day}>
              <h3>{f.formatShortDate(`${day}T12:00:00+09:00`)}</h3>
              {dayShifts.length === 0 && openJobs.length === 0 ? <p className="calendarEmpty">{m.calendar.empty}</p> : null}
              {dayShifts.map((shift) => (
                <Link className={`calendarShift calendarShift-${shift.status}`} href={`/attendance#shift-${shift.id}`} key={shift.id}>
                  <strong>{f.formatTimeRange(shift.scheduledStartAt, shift.scheduledEndAt)}</strong>
                  <span>{workerName(shift)}</span>
                  <small>{m.labels.shiftStatus[shift.status]}</small>
                </Link>
              ))}
              {openJobs.map((job) => (
                <Link className={`calendarOpen${job.urgent ? " calendarOpen-urgent" : ""}`} href={`/applications#job-${job.id}`} key={job.id}>
                  <strong>{f.formatTimeRange(job.startsAt, job.endsAt)}</strong>
                  <span>{job.title}</span>
                  <small>{fill(job.urgent ? m.calendar.urgentSlots : m.calendar.openSlots, { count: job.capacity - selectedCount(job.id) })}</small>
                </Link>
              ))}
            </li>
          );
        })}
      </ol>
      <ul className="calendarLegend" role="list">
        <li><i className="swatch swatch-shift" />{m.calendar.legend.shift}</li>
        <li><i className="swatch swatch-open" />{m.calendar.legend.open}</li>
        <li><i className="swatch swatch-urgent" />{m.calendar.legend.urgent}</li>
      </ul>
    </div>
  );
}
