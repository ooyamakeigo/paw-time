"use client";

import { useId } from "react";
import { ActionMessage, SubmitButton, useFormAction } from "@/components/ActionForm";
import { useMessages } from "@/lib/i18n/client";
import { correctAttendanceAction } from "./actions";

type CorrectionFormProps = {
  shiftId: string;
  eventId: string;
  /** The punch's current date and time, as form values. */
  date: string;
  time: string;
};

/** Moves one punch to the right time, with the reason the record keeps. */
export function CorrectionForm({ shiftId, eventId, date, time }: CorrectionFormProps) {
  const m = useMessages();
  const [state, formAction] = useFormAction(correctAttendanceAction);
  const requestId = useId();
  return (
    <form action={formAction} className="correctionForm">
      <input name="shiftId" type="hidden" value={shiftId} />
      <input name="eventId" type="hidden" value={eventId} />
      <input name="clientRequestId" type="hidden" value={`correction-${eventId}-${requestId}-${state.status}`} />
      <label className="field compactField">
        <span className="visuallyHidden">{m.attendance.date}</span>
        <input defaultValue={state.fields?.date ?? date} name="date" required type="date" />
      </label>
      <label className="field compactField">
        <span className="visuallyHidden">{m.attendance.log.newTime}</span>
        <input defaultValue={state.fields?.time ?? time} name="time" required type="time" />
      </label>
      <label className="field compactField correctionReason">
        <span className="visuallyHidden">{m.attendance.log.reason}</span>
        <input
          defaultValue={state.fields?.reason ?? ""}
          maxLength={500}
          name="reason"
          placeholder={m.attendance.log.reasonPlaceholder}
          required
          type="text"
        />
      </label>
      <SubmitButton pendingLabel={m.common.saving} variant="secondary">{m.attendance.log.submit}</SubmitButton>
      <ActionMessage state={state} />
    </form>
  );
}
