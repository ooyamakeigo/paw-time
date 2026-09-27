"use server";

import { AttendanceEventKindSchema, type AttendanceEvent, type JobPosting, type Shift } from "@paw-time/api-contracts";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { postBusiness } from "@/lib/api";
import { toJstTimestamp } from "@/lib/format";
import { errorMessage, fill, type Messages } from "@/lib/i18n/messages";
import { getMessages } from "@/lib/i18n/server";
import { rewardExperience } from "@/lib/island";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

function punchToast(kind: AttendanceEvent["kind"], m: Messages): string {
  switch (kind) {
    case "check_in":
      return m.attendance.toastCheckedIn;
    case "check_out":
      return m.attendance.toastCheckedOut;
    case "break_start":
      return m.attendance.toastBreakStarted;
    case "break_end":
      return m.attendance.toastBreakEnded;
  }
}

export async function recordAttendanceAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { m } = await getMessages();
  const shiftId = encodeURIComponent(String(formData.get("shiftId") ?? ""));
  const kind = AttendanceEventKindSchema.safeParse(formData.get("kind"));
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const clientRequestId = String(formData.get("clientRequestId") ?? "");
  if (!kind.success) return { status: "error", message: errorMessage("invalid_request", m) };
  if (!DATE_PATTERN.test(date) || !TIME_PATTERN.test(time)) {
    return { status: "error", message: m.attendance.errorDateTime };
  }

  const result = await postBusiness<AttendanceEvent>(`/shifts/${shiftId}/attendance`, {
    kind: kind.data,
    recordedAt: toJstTimestamp(date, time),
    clientRequestId,
  });
  if (!result.ok) return { status: "error", message: errorMessage(result.code, m) };

  revalidatePath("/", "layout");
  return { status: "success", message: punchToast(kind.data, m) };
}

/** Replaces a punch time with a reason; the original stays in the history. */
export async function correctAttendanceAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { m } = await getMessages();
  const shiftId = encodeURIComponent(String(formData.get("shiftId") ?? ""));
  const eventId = String(formData.get("eventId") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const clientRequestId = String(formData.get("clientRequestId") ?? "");
  const fields = { date, time, reason };
  if (!DATE_PATTERN.test(date) || !TIME_PATTERN.test(time)) {
    return { status: "error", message: m.attendance.errorDateTime, fields };
  }
  if (!reason || reason.length > 500) return { status: "error", message: m.attendance.log.errorReason, fields };

  const result = await postBusiness<AttendanceEvent>(`/shifts/${shiftId}/attendance/corrections`, {
    eventId,
    recordedAt: toJstTimestamp(date, time),
    reason,
    clientRequestId,
  });
  if (!result.ok) return { status: "error", message: errorMessage(result.code, m), fields };

  revalidatePath("/", "layout");
  return { status: "success", message: m.attendance.log.toast };
}

export async function confirmShiftAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { m } = await getMessages();
  const shiftId = encodeURIComponent(String(formData.get("shiftId") ?? ""));
  const result = await postBusiness<Shift>(`/shifts/${shiftId}/confirm`);
  if (!result.ok) return { status: "error", message: errorMessage(result.code, m) };
  revalidatePath("/", "layout");
  return {
    status: "success",
    message: fill(m.attendance.toastConfirmed, { xp: rewardExperience("attendance_confirmed") }),
  };
}

export async function markNoShowAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { m } = await getMessages();
  const shiftId = encodeURIComponent(String(formData.get("shiftId") ?? ""));
  const result = await postBusiness<Shift>(`/shifts/${shiftId}/no-show`);
  if (!result.ok) return { status: "error", message: errorMessage(result.code, m) };
  revalidatePath("/", "layout");
  return { status: "success", message: m.attendance.toastNoShow };
}

/** Reposts the slot a no-show or cancellation left open, as an urgent single-opening job. */
export async function createUrgentJobAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { m } = await getMessages();
  const shiftId = encodeURIComponent(String(formData.get("shiftId") ?? ""));
  const result = await postBusiness<JobPosting>(`/shifts/${shiftId}/urgent-job`);
  if (!result.ok) return { status: "error", message: errorMessage(result.code, m) };
  revalidatePath("/", "layout");
  return { status: "success", message: m.attendance.toastUrgent };
}
