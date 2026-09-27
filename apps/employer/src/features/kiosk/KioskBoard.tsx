"use client";

import type { Application, AttendanceEventKind, AttendanceSummary, JobPosting, Shift } from "@paw-time/api-contracts";
import { useEffect, useState } from "react";
import { ActionMessage, SubmitButton, useFormAction } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { createFormatters } from "@/lib/format";
import { useLocale, useMessages } from "@/lib/i18n/client";
import { kioskPunchAction } from "./actions";

type KioskBoardProps = {
  shifts: Shift[];
  summaries: AttendanceSummary[];
  applications: Application[];
  jobs: JobPosting[];
  /** The server's clock when the page was rendered, so the first paint matches the server exactly. */
  initialNow: string;
};

/** Tablet by the door: tap your name, tap one big button. */
export function KioskBoard({ shifts, summaries, applications, jobs, initialNow }: KioskBoardProps) {
  const m = useMessages();
  const locale = useLocale();
  const f = createFormatters(locale);
  const [selected, setSelected] = useState<string | null>(null);
  // Start from the server's time: a clock read during hydration would differ from the server's HTML
  // whenever the minute turned in between, and React would report a hydration mismatch.
  const [now, setNow] = useState(() => new Date(initialNow));
  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  const shift = shifts.find((candidate) => candidate.id === selected);
  const name = (candidate: Shift) =>
    applications.find((application) => application.id === candidate.applicationId)?.workerDisplayName ?? m.attendance.fallbackWorker;

  return (
    <div className="kiosk">
      <header className="kioskHeader">
        <p className="eyebrow eyebrow-gold">{m.kiosk.eyebrow}</p>
        <h1>{shift ? name(shift) : m.kiosk.title}</h1>
        <p className="kioskClock">{f.formatTime(now)}</p>
      </header>
      {shift ? (
        <KioskPunch
          job={jobs.find((job) => job.id === shift.jobPostingId)}
          name={name(shift)}
          onBack={() => setSelected(null)}
          shift={shift}
          summary={summaries.find((summary) => summary.shiftId === shift.id)}
        />
      ) : shifts.length === 0 ? (
        <p className="kioskEmpty">{m.kiosk.noShifts}</p>
      ) : (
        <ul className="kioskNames" role="list">
          {shifts.map((candidate) => {
            const summary = summaries.find((entry) => entry.shiftId === candidate.id);
            return (
              <li key={candidate.id}>
                <button className="kioskName" onClick={() => setSelected(candidate.id)} type="button">
                  <Avatar name={name(candidate)} seed={candidate.workerId} />
                  <span className="kioskNameText">
                    <strong>{name(candidate)}</strong>
                    <small>{f.formatTimeRange(candidate.scheduledStartAt, candidate.scheduledEndAt)}</small>
                  </span>
                  <span className={`status status-shift-${candidate.status}`}>
                    {summary?.onBreak ? m.attendance.onBreak : m.labels.shiftStatus[candidate.status]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="kioskHint">{m.kiosk.hint}</p>
    </div>
  );
}

type KioskPunchProps = {
  shift: Shift;
  summary: AttendanceSummary | undefined;
  job: JobPosting | undefined;
  name: string;
  onBack: () => void;
};

function KioskPunch({ shift, summary, job, name, onBack }: KioskPunchProps) {
  const m = useMessages();
  const [state, formAction] = useFormAction(kioskPunchAction);
  const kinds: Array<{ kind: AttendanceEventKind; label: string; variant: "primary" | "secondary" }> =
    shift.status === "scheduled"
      ? [{ kind: "check_in", label: m.kiosk.checkIn, variant: "primary" }]
      : shift.status === "checked_in" && summary?.onBreak
        ? [{ kind: "break_end", label: m.kiosk.breakEnd, variant: "primary" }]
        : shift.status === "checked_in"
          ? [
              { kind: "break_start", label: m.kiosk.breakStart, variant: "secondary" },
              { kind: "check_out", label: m.kiosk.checkOut, variant: "primary" },
            ]
          : [];
  return (
    <div className="kioskPunch">
      <p className="kioskJob">{job?.title}</p>
      {kinds.length === 0 ? (
        <p className="kioskDone">{shift.status === "checked_out" ? m.kiosk.awaiting : m.kiosk.done}</p>
      ) : (
        <form action={formAction} className="kioskButtons">
          <input name="shiftId" type="hidden" value={shift.id} />
          <input name="workerId" type="hidden" value={shift.workerId} />
          <input name="name" type="hidden" value={name} />
          {kinds.map((entry) => (
            <SubmitButton key={entry.kind} name="kind" pendingLabel={m.common.recording} value={entry.kind} variant={entry.variant}>
              {entry.label}
            </SubmitButton>
          ))}
          <ActionMessage state={state} />
        </form>
      )}
      <button className="button button-ghost kioskBack" onClick={onBack} type="button">{m.kiosk.back}</button>
    </div>
  );
}
